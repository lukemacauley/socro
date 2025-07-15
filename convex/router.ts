import { httpRouter } from "convex/server";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { ChangeNotificationCollection } from "@microsoft/microsoft-graph-types";

const http = httpRouter();

http.route({
  path: "/webhook/microsoft",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const validationToken = new URL(request.url).searchParams.get(
        "validationToken"
      );

      if (validationToken) {
        return new Response(validationToken, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }

      const body: ChangeNotificationCollection = await request.json();

      if (body.value && Array.isArray(body.value)) {
        for (const notification of body.value) {
          if (notification.changeType === "created") {
            const emailId = notification.resource?.split("/").pop() || "";

            await ctx.scheduler.runAfter(
              0,
              internal.webhooks.fetchAndProcessEmail,
              {
                emailId,
                subscriptionId: notification.subscriptionId || "",
              }
            );
          }
        }
      }
      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("[WEBHOOK HTTP] Error processing webhook:", error);
      return new Response("Error processing webhook", { status: 500 });
    }
  }),
});

// Clerk webhook endpoint
http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request);
    if (!event) {
      return new Response("Error occured", { status: 400 });
    }
    switch (event.type) {
      case "user.created": // intentional fallthrough
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          data: event.data,
        });

        const hasMicrosoftOAuth = event.data.external_accounts?.some(
          (account) => account.provider === "oauth_microsoft"
        );

        if (hasMicrosoftOAuth) {
          await ctx.scheduler.runAfter(
            0,
            internal.webhooks.setupMicrosoftWebhook,
            {
              clerkUserId: event.data.id,
            }
          );
        }
        break;

      case "user.deleted": {
        const clerkUserId = event.data.id!;
        await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId });
        console.log("[CLERK WEBHOOK] User deleted", clerkUserId);
        break;
      }
      default:
        console.log("Ignored Clerk webhook event", event.type);
    }

    return new Response(null, { status: 200 });
  }),
});

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payloadString = await req.text();
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id")!,
    "svix-timestamp": req.headers.get("svix-timestamp")!,
    "svix-signature": req.headers.get("svix-signature")!,
  };

  if (!process.env.CLERK_WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return null;
  }

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
  } catch (error) {
    console.error("Error verifying webhook event", error);
    return null;
  }
}

export default http;
