import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getCurrentUser, verifyConversationOwnership } from "./lib/utils";
import { type Id } from "./_generated/dataModel";
import { streamingComponent } from "./streaming";

export const list = query({
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    let conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);

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

export const sendMessage = mutation({
  args: {
    prompt: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<Id<"messages">> => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    await verifyConversationOwnership(ctx, args.conversationId, userId);

    const responseStreamId = await streamingComponent.createStream(ctx);

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      content: args.prompt,
      streamId: responseStreamId,
      type: "user_note",
      sender: userId,
      timestamp: Date.now(),
    });

    return messageId;
  },
});
