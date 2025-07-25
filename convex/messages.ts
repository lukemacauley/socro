import { v } from "convex/values";
import {
  internalQuery,
  internalMutation,
  internalAction,
  action,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import { Groq } from "groq-sdk";

export const sendMessage = action({
  args: {
    content: v.string(),
    uploadId: v.optional(v.string()),
    threadId: v.id("threads"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    userMessageId: Id<"messages">;
    responseMessageId: Id<"messages">;
  }> => {
    const userId = await ctx.runQuery(internal.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const { userMessageId, responseMessageId } = await ctx.runMutation(
      internal.messages.insertWithResponsePlaceholder,
      {
        threadId: args.threadId,
        content: args.content,
        uploadId: args.uploadId,
        userId,
      }
    );

    await ctx.runAction(internal.messages.generateStreamingResponse, {
      threadId: args.threadId,
      responseMessageId,
    });

    return {
      userMessageId,
      responseMessageId,
    };
  },
});

export const retryMessage = action({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(internal.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get message and verify ownership in one mutation
    const message = await ctx.runMutation(
      internal.messages.resetMessageForRetry,
      {
        messageId: args.messageId,
        userId,
      }
    );

    // Generate new response
    await ctx.runAction(internal.messages.generateStreamingResponse, {
      threadId: message.threadId,
      responseMessageId: args.messageId,
    });

    return { messageId: args.messageId };
  },
});

export const createThreadAndSendMessage = action({
  args: {
    content: v.string(),
    uploadId: v.optional(v.string()),
    browserId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    threadId: Id<"threads">;
    userMessageId: Id<"messages">;
    responseMessageId: Id<"messages">;
  }> => {
    const userId = await ctx.runQuery(internal.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const threadId = await ctx.runMutation(internal.messages.createChatThread, {
      userId,
      browserId: args.browserId,
    });

    const { userMessageId, responseMessageId } = await ctx.runMutation(
      internal.messages.insertWithResponsePlaceholder,
      {
        threadId,
        content: args.content,
        uploadId: args.uploadId,
        userId,
      }
    );

    // Generate title for the new chat thread
    await ctx.scheduler.runAfter(0, internal.messages.generateThreadTitle, {
      threadId,
      content: args.content,
    });

    await ctx.runAction(internal.messages.generateStreamingResponse, {
      threadId,
      responseMessageId,
    });

    return {
      threadId,
      userMessageId,
      responseMessageId,
    };
  },
});

// Helper mutation to insert user message
export const insertWithResponsePlaceholder = internalMutation({
  args: {
    content: v.string(),
    uploadId: v.optional(v.string()),
    threadId: v.id("threads"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userMessageId = await ctx.db.insert("messages", {
      content: args.content,
      role: "user",
      userId: args.userId,
      threadId: args.threadId,
      type: "user",
    });

    if (args.uploadId) {
      const attachments = await ctx.db
        .query("messageAttachments")
        .withIndex("by_upload_id", (q) => q.eq("uploadId", args.uploadId))
        .collect();

      for (const attachment of attachments) {
        await ctx.db.patch(attachment._id, {
          messageId: userMessageId,
          threadId: args.threadId,
        });
      }
    }

    const responseMessageId = await ctx.db.insert("messages", {
      content: "",
      role: "ai",
      userId: args.userId,
      threadId: args.threadId,
      isStreaming: true,
      streamingComplete: false,
      type: "ai",
    });

    return {
      userMessageId,
      responseMessageId,
    };
  },
});

export const generateStreamingResponse = internalAction({
  args: {
    threadId: v.id("threads"),
    responseMessageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    // The actual streaming happens via the HTTP endpoint
    // This action now just serves as a trigger
    // The client will connect to the SSE endpoint to receive the stream
    console.log(
      "Streaming will happen via HTTP endpoint for message:",
      args.responseMessageId
    );
  },
});

export const getThreadHistory = internalQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.neq(q.field("isStreaming"), true))
      .order("asc")
      .collect();

    const messagesWithAttachments = await Promise.all(
      messages.map(async (message) => {
        const attachments = await ctx.db
          .query("messageAttachments")
          .withIndex("by_message_id", (q) => q.eq("messageId", message._id))
          .collect();

        return {
          ...message,
          attachments,
        };
      })
    );

    return messagesWithAttachments;
  },
});

export const completeStreaming = internalMutation({
  args: {
    messageId: v.id("messages"),
    finalContent: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: args.finalContent,
      isStreaming: false,
      streamingComplete: true,
    });
  },
});

export const createChatThread = internalMutation({
  args: {
    userId: v.id("users"),
    browserId: v.string(),
  },
  handler: async (ctx, args) => {
    const threadId = await ctx.db.insert("threads", {
      title: "New Chat",
      browserId: args.browserId,
      lastActivityAt: Date.now(),
      userId: args.userId,
    });

    return threadId;
  },
});

export const generateThreadTitle = internalAction({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const groq = new Groq();

      const response = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: `Generate a short, descriptive title (max 5 words) for a conversation that starts with this message: ${args.content}.
            Requirements:
            - Maximum 5 words
            - Be specific and descriptive
            - No quotes or punctuation
            - Just return the title, nothing else`,
          },
        ],
        model: "moonshotai/kimi-k2-instruct",
        stream: false,
      });

      let fullContent = "";

      for await (const textPart of response.choices) {
        const chunk = textPart.message.content;
        if (!chunk) {
          continue;
        }
        fullContent += chunk;
      }

      const title = fullContent.trim();

      let contentPreview = args.content.trim();
      if (contentPreview.length > 100) {
        contentPreview = args.content.substring(0, 100);
      }

      await ctx.runMutation(internal.messages.updateThreadTitleAndPreview, {
        threadId: args.threadId,
        title,
        contentPreview,
      });
    } catch (error) {
      console.error("Failed to generate title:", error);
    }
  },
});

export const updateThreadTitleAndPreview = internalMutation({
  args: {
    threadId: v.id("threads"),
    title: v.string(),
    contentPreview: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      title: args.title,
      contentPreview: args.contentPreview,
    });
  },
});

export const resetMessageForRetry = internalMutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Only allow retry on AI messages
    if (message.role !== "ai") {
      throw new Error("Can only retry AI messages");
    }

    // Reset message state
    await ctx.db.patch(args.messageId, {
      content: "",
      isStreaming: true,
      streamingComplete: false,
    });

    return message;
  },
});
