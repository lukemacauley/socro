import { getAuth } from "@clerk/react-router/ssr.server";
import { createClerkClient } from "@clerk/react-router/api.server";
import type { Route } from "./+types/home";
import { Client } from "@microsoft/microsoft-graph-client";

function createGraphClient(accessToken: string) {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);

  if (!userId) {
    return { user: null };
  }

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  const microsoftAuth = await clerk.users.getUserOauthAccessToken(
    userId,
    "microsoft"
  );

  const userAccessToken = microsoftAuth.data?.[0]?.token;

  if (!userAccessToken) {
    return { error: "No Microsoft access token found" };
  }

  const client = createGraphClient(userAccessToken);

  // Fetch emails on page load (excluding junk/spam)
  let emails = [];
  try {
    const emailsResponse = await client
      .api("/me/mailFolders/inbox/messages")
      .top(20)
      .select("subject,from,receivedDateTime,bodyPreview,isRead")
      .orderby("receivedDateTime desc")
      .get();

    emails = emailsResponse.value;
  } catch (error) {
    console.error("Error fetching emails:", error);
  }

  const notificationUrl =
    process.env.WEBHOOK_URL + "/api/webhooks/microsoft/email";

  // Create subscription with proper token
  try {
    const subscription = await fetch(
      "https://graph.microsoft.com/v1.0/subscriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          changeType: "created",
          notificationUrl,
          resource: "me/messages",
          expirationDateTime: new Date(
            Date.now() + 4230 * 60 * 1000
          ).toISOString(),
        }),
      }
    );

    if (!subscription.ok) {
      const error = await subscription.json();
      console.log("Subscription error:", error);

      if (subscription.status === 401) {
        // Token expired, trigger re-authorization
        return {
          needsAuthorization: true,
          authUrl: `/auth/microsoft?userId=${userId}`,
        };
      }

      return { emails, error };
    } else {
      const data = await subscription.json();
      return { emails, subscription: data };
    }
  } catch (error) {
    console.log("Error:", error);
    return { emails, error: "Failed to create subscription" };
  }
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const emails = loaderData?.emails || [];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Your Emails</h1>

      {loaderData?.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {loaderData.error}
        </div>
      )}

      {loaderData?.subscription && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          Webhook subscription active: {loaderData.subscription.id}
        </div>
      )}

      <div className="space-y-4">
        {emails.length === 0 ? (
          <p className="text-gray-500">No emails found</p>
        ) : (
          emails.map((email: any) => (
            <div
              key={email.id}
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {email.subject || "(No subject)"}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    From:{" "}
                    {email.from?.emailAddress?.name ||
                      email.from?.emailAddress?.address ||
                      "Unknown"}
                  </p>
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                    {email.bodyPreview}
                  </p>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-sm text-gray-500">
                    {new Date(email.receivedDateTime).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(email.receivedDateTime).toLocaleTimeString()}
                  </p>
                  {!email.isRead && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                      Unread
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
