import { internalMutation, internalQuery } from "./_generated/server";
import { v, type Validator } from "convex/values";
import { internal } from "./_generated/api";
import type {
  OrganizationCreatedEvent,
  OrganizationUpdatedEvent,
} from "@workos-inc/node";

type OrganizationWebhookEvent = (
  | OrganizationCreatedEvent
  | OrganizationUpdatedEvent
)["data"];

export const getByWorkOSId = internalQuery({
  args: { workOSId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organisations")
      .withIndex("by_workos_id", (q) => q.eq("workOSId", args.workOSId))
      .first();
  },
});

export const upsertFromWorkOS = internalMutation({
  args: { data: v.any() as Validator<OrganizationWebhookEvent> }, // no runtime validation, trust WorkOS
  async handler(ctx, { data }) {
    const organisationAttributes = {
      name: data.name,
      workOSId: data.id,
      slug:
        data.domains && data.domains.length > 0
          ? urlToSlug(data.domains[0].domain)
          : undefined,
    };

    const organisation = await ctx.runQuery(
      internal.organisations.getByWorkOSId,
      {
        workOSId: data.id,
      }
    );

    if (organisation === null) {
      await ctx.db.insert("organisations", organisationAttributes);
    } else {
      await ctx.db.patch(organisation._id, organisationAttributes);
    }
  },
});

export const deleteFromWorkOS = internalMutation({
  args: { workOSId: v.string() },
  async handler(ctx, args) {
    const organisation = await ctx.runQuery(
      internal.organisations.getByWorkOSId,
      {
        workOSId: args.workOSId,
      }
    );

    if (organisation !== null) {
      await ctx.db.delete(organisation._id);
    } else {
      console.warn(
        `Can't delete organisation, there is none for WorkOS organisation ID: ${args.workOSId}`
      );
    }
  },
});

function urlToSlug(url: string): string {
  try {
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
    const hostname = urlObj.hostname.replace(/^www\./, "");
    return hostname.split(".")[0];
  } catch (e) {
    return url.split(".")[0];
  }
}
