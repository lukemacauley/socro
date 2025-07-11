import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { messageType } from "./lib/validators";
import { outlookEmailSchema } from "./schema";

export const getThreads = query({
  args: {
    threadType: v.optional(v.union(v.literal("chat"), v.literal("email"))),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const threads = args.threadType
      ? await ctx.db
          .query("threads")
          .withIndex("by_type", (q) => q.eq("threadType", args.threadType!))
          .order("desc")
          .collect()
      : await ctx.db.query("threads").order("desc").collect();

    // Get message counts and latest message for each thread
    const threadsWithDetails = await Promise.all(
      threads.map(async (thread) => {
        const message = await ctx.db
          .query("messages")
          .withIndex("by_thread_id", (q) => q.eq("threadId", thread._id))
          .order("desc")
          .first();

        return {
          ...thread,
          latestMessage: message,
        };
      })
    );

    return threadsWithDetails.sort(
      (a, b) => b.lastActivityAt - a.lastActivityAt
    );
  },
});

export const getThread = query({
  args: { id: v.id("threads") },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    // Get thread info
    const thread = await ctx.db.get(args.id);

    if (!thread) {
      return null;
    }

    // Get all messages in the thread
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.id))
      .order("asc")
      .collect();

    // Get streaming chunks for assistant messages
    const messagesWithChunks = await Promise.all(
      messages.map(async (message) => {
        if (message.role === "ai" && message.isStreaming) {
          const chunks = await ctx.db
            .query("streamingChunks")
            .withIndex("by_message", (q) => q.eq("messageId", message._id))
            .order("asc")
            .collect();

          const streamedContent = chunks.map((chunk) => chunk.chunk).join("");
          return {
            ...message,
            content: streamedContent || message.content,
            chunks: chunks.length,
          };
        }
        return message;
      })
    );

    return {
      thread,
      messages: messagesWithChunks,
    };
  },
});

export const sendThreadMessage = mutation({
  args: {
    content: v.string(),
    threadId: v.id("threads"),
    externalThreadId: v.string(),
    messageType: v.optional(messageType),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    userMessageId: string;
    responseMessageId: string;
  }> => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // const userInfo = await ctx.runQuery(internal.auditLog.getUserInfo, {
    //   userId,
    // });

    // try {
    // Get or create thread
    const thread = await ctx.db.get(args.threadId);

    //   if (!thread) {
    //     // Create new chat thread
    //     const newThreadId = await ctx.db.insert("threads", {
    //       subject: "Chat Conversation",
    //       threadType: "chat",
    //       externalThreadId: args.externalThreadId,
    //         lastActivityAt: Date.now(),

    //     });
    //     thread = {
    //       _id: newThreadId,
    //       threadId: args.threadId,
    //       threadType: "chat",
    //     } as any;
    //   }

    // Insert user message
    const userMessageId = await ctx.db.insert("messages", {
      content: args.content,
      role: "user",
      userId,
      threadId: args.threadId,
      messageType: args.messageType || "user_message",
    });

    // Update thread activity
    if (thread) {
      await ctx.db.patch(thread._id, {
        lastActivityAt: Date.now(),
      });
    }

    // // Log message sent
    // await ctx.runMutation(internal.auditLog.createAuditLog, {
    //   eventType: "message_sent",
    //   userId,
    //   userEmail: userInfo?.email,
    //   userName: userInfo?.name,
    //   action: `Sent message in thread ${args.threadId}`,
    //   resource: `message:${userMessageId}`,
    //   resourceType: "message",
    //   resourceId: userMessageId,
    //   metadata: {
    //     threadId: args.threadId,
    //     messageId: userMessageId,
    //   },
    //   status: "success",
    //   severity: "low",
    //   category: "communication",
    // });

    // Create placeholder assistant message
    const responseMessageId = await ctx.db.insert("messages", {
      content: "",
      role: "ai",
      userId,
      threadId: args.threadId,
      messageType: "ai_response",
      isStreaming: true,
      streamingComplete: false,
    });

    // Schedule AI response generation

    await ctx.scheduler.runAfter(
      0,
      internal.messages.generateStreamingResponse,
      {
        threadId: args.threadId,
        responseMessageId,
      }
    );

    return { userMessageId, responseMessageId };
    // } catch (error) {
    //   // Log error
    //   await ctx.runMutation(internal.auditLog.createAuditLog, {
    //     eventType: "error_occurred",
    //     userId,
    //     userEmail: userInfo?.email,
    //     userName: userInfo?.name,
    //     action: `Failed to send message in thread ${args.threadId}`,
    //     resource: `thread:${args.threadId}`,
    //     resourceType: "conversation",
    //     resourceId: args.threadId,
    //     metadata: {
    //       threadId: args.threadId,
    //       additionalData: JSON.stringify({ error: (error as Error).message }),
    //     },
    //     status: "failure",
    //     errorMessage: (error as Error).message,
    //     severity: "high",
    //     category: "error",
    //   });
    //   throw error;
    // }
  },
});

export const processIncomingEmail = internalMutation({
  args: {
    email: outlookEmailSchema,
    externalSubscriptionId: v.string(),
    isSentEmail: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    threadId: string;
    emailMessageId: string;
    responseMessageId: string;
  }> => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // try {
    // Create or update email thread
    let thread = await ctx.db
      .query("threads")
      .withIndex("by_external_subscription_id", (q) =>
        q.eq("externalSubscriptionId", args.externalSubscriptionId)
      )
      .unique();

    let threadId = thread?._id;

    const e = args.email;

    if (!threadId) {
      // Create new email thread
      const newThreadId = await ctx.db.insert("threads", {
        subject: e.subject || "New Email",
        threadType: "email",
        fromParticipants: {
          email: e.from?.emailAddress?.address || "",
          name: e.from?.emailAddress?.name,
        },
        toParticipants:
          e.toRecipients?.map((r) => ({
            email: r.emailAddress?.address || "",
            name: r.emailAddress?.name,
          })) || [],
        externalThreadId: e.conversationId || "",
        externalSubscriptionId: args.externalSubscriptionId,
        lastActivityAt: e.receivedDateTime
          ? new Date(e.receivedDateTime).getTime()
          : Date.now(),
        status: "new",
        userId,
      });
      threadId = newThreadId;
    } else {
      // Update existing thread
      await ctx.db.patch(threadId, {
        lastActivityAt: e.receivedDateTime
          ? new Date(e.receivedDateTime).getTime()
          : Date.now(),
      });
    }

    // Create message for the received email
    const emailMessageId = await ctx.db.insert("messages", {
      content: e.uniqueBody?.content || "",
      role: "system",
      userId,
      threadId,
      messageType: "received_email",
      threadType: "email",
      attachments: e.hasAttachments
        ? e.attachments?.map((a) => ({
            id: a.id || "",
            name: a.name || "",
            contentType: a.contentType || "",
            size: a.size || 0,
          }))
        : undefined,
    });

    //   // Log email received
    //   await ctx.runMutation(internal.auditLog.createAuditLog, {
    //     eventType: "email_received",
    //     userId: undefined,
    //     action: `Received email from ${args.fromEmail}: ${args.subject}`,
    //     resource: `thread:${args.threadId}`,
    //     resourceType: "email",
    //     resourceId: args.threadId,
    //     metadata: {
    //       threadId: args.threadId,
    //       messageId: emailMessageId,
    //       additionalData: JSON.stringify({
    //         fromEmail: args.fromEmail,
    //         subject: args.subject,
    //         bodyLength: args.body.length,
    //       }),
    //     },
    //     status: "success",
    //     severity: "medium",
    //     category: "communication",
    //   });

    // Create placeholder assistant message for AI response
    const responseMessageId = await ctx.db.insert("messages", {
      content: "",
      role: "ai",
      userId,
      threadId,
      messageType: "ai_response",
      isStreaming: true,
      streamingComplete: false,
    });

    // Schedule AI response generation
    await ctx.scheduler.runAfter(
      0,
      internal.messages.generateStreamingResponse,
      {
        threadId,
        responseMessageId,
      }
    );

    return { threadId, emailMessageId, responseMessageId };
    // } catch (error) {
    //   // Log error
    //   await ctx.runMutation(internal.auditLog.createAuditLog, {
    //     eventType: "error_occurred",
    //     userId: undefined,
    //     action: `Failed to process incoming email from ${args.fromEmail}`,
    //     resource: `thread:${args.threadId}`,
    //     resourceType: "email",
    //     resourceId: args.threadId,
    //     metadata: {
    //       threadId: args.threadId,
    //       additionalData: JSON.stringify({
    //         error: (error as Error).message,
    //         fromEmail: args.fromEmail,
    //         subject: args.subject,
    //       }),
    //     },
    //     status: "failure",
    //     errorMessage: (error as Error).message,
    //     severity: "critical",
    //     category: "error",
    //   });
    //   throw error;
    // }
  },
});

export const getThreadConversationHistory = internalQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.neq(q.field("isStreaming"), true))
      .order("asc")
      .collect();
  },
});

export const getBySubscriptionId = internalQuery({
  args: { subscriptionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("threads")
      .withIndex("by_external_subscription_id", (q) =>
        q.eq("externalSubscriptionId", args.subscriptionId)
      )
      .unique();
  },
});
