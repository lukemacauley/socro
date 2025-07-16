import { type MutationCtx, query, type QueryCtx } from "./_generated/server";

export const loggedInUserId = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user ? user._id : null;
  },
});

async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
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

  return user;
}
