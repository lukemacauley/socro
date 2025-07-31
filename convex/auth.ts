import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";

export const loggedInUserId = internalQuery({
  handler: async (ctx): Promise<Id<"users"> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.runQuery(internal.auth.getByWorkOSId, {
      workOSId: identity.subject,
    });

    return user ? user._id : null;
  },
});

export const getByWorkOSId = internalQuery({
  args: { workOSId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workOSId", args.workOSId))
      .first();
  },
});
