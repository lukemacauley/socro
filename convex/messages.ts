import { v } from "convex/values";
import {
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import { authedAction, authedMutation } from "./lib/utils";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";

export const sendMessage = authedAction({
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
    const { userMessageId, responseMessageId } = await ctx.runMutation(
      internal.messages.insertWithResponsePlaceholder,
      {
        threadId: args.threadId,
        content: args.content,
        uploadId: args.uploadId,
        userId: ctx.userId,
      }
    );

    return {
      userMessageId,
      responseMessageId,
    };
  },
});

export const retryMessage = authedMutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.messages.resetMessageForRetry, {
      messageId: args.messageId,
    });
  },
});

export const editMessage = authedMutation({
  args: {
    messageId: v.id("messages"),
    threadId: v.id("threads"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.messages.resetMessageForEdit, {
      userId: ctx.userId,
      messageId: args.messageId,
      threadId: args.threadId,
      content: args.content,
    });
  },
});

export const createThreadAndSendMessage = authedAction({
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
    const threadId = await ctx.runMutation(internal.messages.createChatThread, {
      userId: ctx.userId,
      browserId: args.browserId,
    });

    const { userMessageId, responseMessageId } = await ctx.runMutation(
      internal.messages.insertWithResponsePlaceholder,
      {
        threadId,
        content: args.content,
        uploadId: args.uploadId,
        userId: ctx.userId,
      }
    );

    await ctx.scheduler.runAfter(0, internal.messages.generateThreadTitle, {
      threadId,
      content: args.content,
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
    });

    return {
      userMessageId,
      responseMessageId,
    };
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
      const response = await generateText({
        model: groq("moonshotai/kimi-k2-instruct"),
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
      });

      let title = "";
      if (response.text) {
        title = response.text.trim();
      }

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
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    if (message.role !== "ai") {
      throw new Error("Can only retry AI messages");
    }

    await ctx.db.patch(args.messageId, {
      content: "",
      isStreaming: true,
      streamingComplete: false,
    });

    return message;
  },
});

export const resetMessageForEdit = internalMutation({
  args: {
    messageId: v.id("messages"),
    threadId: v.id("threads"),
    userId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: args.content,
    });

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();

    const messageIndex = messages.findIndex((m) => m._id === args.messageId);
    const messagesToDelete = messages.slice(messageIndex + 1);

    for (const msg of messagesToDelete) {
      await ctx.db.delete(msg._id);
    }

    await ctx.db.insert("messages", {
      content: "",
      role: "ai",
      userId: args.userId,
      threadId: args.threadId,
      isStreaming: true,
      streamingComplete: false,
    });
  },
});
