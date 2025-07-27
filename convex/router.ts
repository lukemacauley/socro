import { httpRouter } from "convex/server";
import { streamMessage } from "./streamingHttp";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

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

export default http;
