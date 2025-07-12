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
    console.log("[WEBHOOK HTTP] ============ WEBHOOK RECEIVED ============");
    console.log("[WEBHOOK HTTP] Request URL:", request.url);
    console.log("[WEBHOOK HTTP] Request method:", request.method);

    try {
      const validationToken = new URL(request.url).searchParams.get(
        "validationToken"
      );

      if (validationToken) {
        console.log(
          "[WEBHOOK HTTP] Validation request received, token:",
          validationToken
        );
        return new Response(validationToken, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }

      const body: ChangeNotificationCollection = await request.json();

      // Process webhook notifications
      if (body.value && Array.isArray(body.value)) {
        console.log(
          `[WEBHOOK HTTP] Processing ${body.value.length} notifications`
        );

        for (const notification of body.value) {
          console.log(`[WEBHOOK HTTP] Notification:`, notification);

          if (notification.changeType === "created") {
            console.log("[WEBHOOK HTTP] Processing new email notification");

            const emailId = notification.resource?.split("/").pop() || "";

            await ctx.scheduler.runAfter(
              0,
              internal.webhooks.fetchAndProcessEmail,
              {
                emailId,
                subscriptionId: notification.subscriptionId || "",
              }
            );
          } else {
            console.log(
              `[WEBHOOK HTTP] Ignoring notification with changeType: ${notification.changeType}`
            );
          }
        }
      } else {
        console.log("[WEBHOOK HTTP] No notifications in webhook body");
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

        console.log({ data: event.data });

        // Check if user has Microsoft OAuth and set up webhook
        console.log("[CLERK WEBHOOK] Checking for Microsoft OAuth...");
        const hasMicrosoftOAuth = event.data.external_accounts?.some(
          (account) => account.provider === "oauth_microsoft"
        );

        if (hasMicrosoftOAuth) {
          console.log(
            "[CLERK WEBHOOK] User has Microsoft OAuth, setting up email webhook..."
          );
          // Schedule the Microsoft webhook setup as a separate action
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
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
  } catch (error) {
    console.error("Error verifying webhook event", error);
    return null;
  }
}

export default http;
