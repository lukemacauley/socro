import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Query to get conversation
export const getConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

// Mutation to update conversation thread ID
export const updateConversationThreadId = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    agentThreadId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      agentThreadId: args.agentThreadId,
    });
  },
});