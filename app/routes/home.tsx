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
  const startTime = performance.now();

  const authStart = performance.now();
  const { userId } = await getAuth(args);
  console.log(
    `[PERF] getAuth: ${(performance.now() - authStart).toFixed(2)}ms`
  );

  if (!userId) {
    return { user: null };
  }

  const clerkStart = performance.now();
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  console.log(
    `[PERF] createClerkClient: ${(performance.now() - clerkStart).toFixed(2)}ms`
  );

  const tokenStart = performance.now();
  const microsoftAuth = await clerk.users.getUserOauthAccessToken(
    userId,
    "microsoft"
  );
  console.log(
    `[PERF] getUserOauthAccessToken: ${(performance.now() - tokenStart).toFixed(
      2
    )}ms`
  );

  const userAccessToken = microsoftAuth.data?.[0]?.token;

  if (!userAccessToken) {
    return { error: "No Microsoft access token found" };
  }

  const client = createGraphClient(userAccessToken);

  // Fetch emails on page load (excluding junk/spam)
  let emails = [];
  const emailStart = performance.now();
  try {
    const emailsResponse = await client
      .api("/me/mailFolders/inbox/messages")
      .top(20)
      .select("subject,from,receivedDateTime,bodyPreview,isRead")
      .orderby("receivedDateTime desc")
      .get();

    emails = emailsResponse.value;
    console.log(
      `[PERF] Fetch emails: ${(performance.now() - emailStart).toFixed(2)}ms`
    );
  } catch (error) {
    console.error("Error fetching emails:", error);
    console.log(
      `[PERF] Fetch emails (failed): ${(performance.now() - emailStart).toFixed(
        2
      )}ms`
    );
  }

  console.log(
    `[PERF] Total loader time: ${(performance.now() - startTime).toFixed(2)}ms`
  );
  return { emails };
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
