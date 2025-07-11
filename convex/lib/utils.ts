import { type QueryCtx, type MutationCtx } from "../_generated/server";
import { type Id } from "../_generated/dataModel";
import { createClerkClient } from "@clerk/backend";

export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
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

export async function getCurrentUserId(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  return user._id;
}

export async function verifyThreadOwnership(
  ctx: QueryCtx | MutationCtx,
  threadId: Id<"threads">,
  userId: Id<"users">
) {
  const thread = await ctx.db.get(threadId);
  if (!thread || thread.userId !== userId) {
    throw new Error(`Thread not found: ${threadId}`);
  }
  return thread;
}
