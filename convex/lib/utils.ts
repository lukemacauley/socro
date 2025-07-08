import { type QueryCtx, type MutationCtx } from "../_generated/server";
import { type Id } from "../_generated/dataModel";
import { createClerkClient } from "@clerk/backend";
import { GenericActionCtx } from "convex/server";

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

export async function verifyConversationOwnership(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">
) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || conversation.userId !== userId) {
    throw new Error("Conversation not found");
  }
  return conversation;
}

export async function getUserSettingsByUserId(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
) {
  return await ctx.db
    .query("userSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

export async function getMicrosoftAccessToken(
  clerkUserId: string
): Promise<string> {
  console.log("[WEBHOOK] Getting fresh access token from Clerk...");
  const clerk = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });

  try {
    const microsoftAuth = await clerk.users.getUserOauthAccessToken(
      clerkUserId,
      "microsoft"
    );

    const accessToken = microsoftAuth.data?.[0]?.token;

    if (!accessToken) {
      console.error("[WEBHOOK] No access token received from Clerk");
      throw new Error("No access token received from Clerk");
    }

    console.log("[WEBHOOK] Successfully got fresh access token from Clerk");
    return accessToken;
  } catch (error) {
    console.error("[WEBHOOK] Error getting access token from Clerk:", error);
    throw new Error("[WEBHOOK] Error getting access token from Clerk:" + error);
  }
}
