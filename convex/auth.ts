import { internalQuery } from "./_generated/server";

export const loggedInUserId = internalQuery({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", identity.subject))
      .first();

    if (!user) {
      return null;
    }

    return user ? user._id : null;
  },
});
