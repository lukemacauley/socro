import { type MutationCtx, query, type QueryCtx } from "./_generated/server";

export const loggedInUser = query({
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const loggedInUserId = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user._id;
  },
});

async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_external_id", (q) => q.eq("externalId", identity.subject))
    .first();

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}
