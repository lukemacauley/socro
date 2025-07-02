import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const list = query({
  args: {
    status: v.optional(
      v.union(v.literal("new"), v.literal("in_progress"), v.literal("resolved"))
    ),
  },
  handler: async (ctx, args) => {
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

    let conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);

    if (args.status) {
      conversations = conversations.filter((c) => c.status === args.status);
    }

    // Get latest message for each conversation
    const conversationsWithLatest = await Promise.all(
      conversations.map(async (conversation) => {
        const latestMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .order("desc")
          .first();

        return {
          ...conversation,
          latestMessage,
        };
      })
    );

    return conversationsWithLatest;
  },
});

export const get = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

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

export const updateStatus = mutation({
  args: {
    conversationId: v.id("conversations"),
    status: v.union(
      v.literal("new"),
      v.literal("in_progress"),
      v.literal("resolved")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(args.conversationId, {
      status: args.status,
      lastActivity: Date.now(),
    });
  },
});

export const addUserNote = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

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
  },
});

export const createTestConversation = mutation({
  args: {
    subject: v.string(),
    content: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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

    const userId = user._id;
    // Create conversation
    const conversationId = await ctx.db.insert("conversations", {
      userId,
      emailId: `test-${Date.now()}`,
      subject: args.subject,
      fromEmail: args.senderEmail,
      fromName: args.senderName,
      status: "new",
      lastActivity: Date.now(),
    });

    // Add email message
    await ctx.db.insert("messages", {
      conversationId,
      content: args.content,
      type: "email",
      sender: args.senderEmail,
      timestamp: Date.now(),
      emailId: `test-msg-${Date.now()}`,
    });

    return conversationId;
  },
});
