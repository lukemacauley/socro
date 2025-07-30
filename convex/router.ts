import { httpRouter } from "convex/server";
import { streamMessage } from "./streamingHttp";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";

const http = httpRouter();

http.route({
  path: "/stream",
  method: "GET",
  handler: streamMessage,
});

http.route({
  path: "/workos-users",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const bodyText = await req.text();
    const sigHeader = String(req.headers.get("workos-signature"));

    const { data, event } = await ctx.runAction(internal.workos.verifyWebhook, {
      payload: bodyText,
      signature: sigHeader,
    });

    switch (event) {
      case "user.created":
      case "user.updated": {
        await ctx.runMutation(internal.users.upsertFromWorkOS, {
          data,
        });
        break;
      }
      case "user.deleted": {
        await ctx.runMutation(internal.users.deleteFromWorkOS, {
          workOSId: data.id,
        });
        console.log(`Deleted user from WorkOS: ${data.id}`);
        break;
      }
      case "organization.created":
      case "organization.updated": {
        await ctx.runMutation(internal.organisations.upsertFromWorkOS, {
          data,
        });
        break;
      }
      case "organization.deleted": {
        await ctx.runMutation(internal.organisations.deleteFromWorkOS, {
          workOSId: data.id,
        });
        break;
      }
      case "organization_membership.created":
      case "organization_membership.updated": {
        await ctx.runMutation(internal.users.updateOrganisationMembership, {
          data,
        });
        break;
      }
      case "organization_membership.deleted": {
        await ctx.runMutation(internal.users.removeOrganisationMembership, {
          workOSUserId: data.userId,
        });
        break;
      }
      default: {
        throw new Error(`Unhandled event type: ${event}`);
      }
    }

    return new Response(JSON.stringify({ status: "success" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

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
