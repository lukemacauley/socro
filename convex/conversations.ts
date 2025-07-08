import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getCurrentUser, verifyConversationOwnership } from "./lib/utils";
import { conversationStatus } from "./lib/validators";

export const list = query({
  args: {
    status: v.optional(conversationStatus),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    let conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);

    if (args.status) {
      conversations = conversations.filter((c) => c.status === args.status);
    }

    // Get latest message and message count for each conversation
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conversation) => {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .collect();

        const latestMessage =
          messages.sort((a, b) => b.timestamp - a.timestamp)[0] || null;

        // Get the most recent participant for display
        const fromParticipant = conversation.participants[
          conversation.participants.length - 1
        ] || {
          email: "unknown@email.com",
          name: null,
        };

        return {
          ...conversation,
          latestMessage,
          messageCount: messages.length,
          fromEmail: fromParticipant.email,
          fromName: fromParticipant.name,
        };
      })
    );

    return conversationsWithDetails;
  },
});

export const get = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    const conversation = await verifyConversationOwnership(
      ctx,
      args.conversationId,
      userId
    );

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    return {
      conversation,
      messages,
    };
  },
});

export const addUserNote = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    const conversation = await verifyConversationOwnership(
      ctx,
      args.conversationId,
      userId
    );

    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      content: args.content,
      type: "user_note",
      sender: userId,
      timestamp: Date.now(),
    });

    await ctx.db.patch(args.conversationId, {
      lastActivity: Date.now(),
    });

    return {
      conversationId: args.conversationId,
      emailContent: args.content,
      emailSubject: conversation.subject || "User Note",
      senderName: "User",
    };
  },
});

// Removed createTestConversation - focus on real email threading
