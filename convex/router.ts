import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { type WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";

const http = httpRouter();

// Microsoft Graph webhook endpoint
http.route({
  path: "/webhook/microsoft",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Verify webhook validation token if present
      const validationToken = new URL(request.url).searchParams.get(
        "validationToken"
      );
      if (validationToken) {
        return new Response(validationToken, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }

      const body = await request.json();

      // Process webhook notifications
      if (body.value && Array.isArray(body.value)) {
        for (const notification of body.value) {
          if (
            notification.changeType === "created" &&
            notification.resourceData
          ) {
            // Process new email
            await ctx.runMutation(internal.webhooks.processEmailNotification, {
              notification,
            });
          }
        }
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("Error processing webhook", { status: 500 });
    }
  }),
});

// Clerk webhook endpoint
// This endpoint handles Clerk user events such as creation, update, and deletion.
http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request);
    if (!event) {
      return new Response("Error occured", { status: 400 });
    }

    console.log({ webhookEvent: event });

    switch (event.type) {
      case "user.created": // intentional fallthrough
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          data: event.data,
        });
        break;

      case "user.deleted": {
        const clerkUserId = event.data.id!;
        await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId });
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
