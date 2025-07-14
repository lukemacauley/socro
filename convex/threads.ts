import { v } from "convex/values";
import {
  query,
  internalQuery,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  nullOrUndefinedBoolean,
  nullOrUndefinedNumber,
  nullOrUndefinedString,
  threadStatus,
} from "./lib/validators";
import type { DataModel, Id } from "./_generated/dataModel";

type ThreadWithLatestMessage = DataModel["threads"]["document"] & {
  latestMessage?: DataModel["messages"]["document"] | null;
};

export const getThreads = query({
  args: {
    threadType: v.optional(v.union(v.literal("chat"), v.literal("email"))),
  },
  handler: async (ctx, args): Promise<Array<ThreadWithLatestMessage>> => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const threads = args.threadType
      ? await ctx.db
          .query("threads")
          .withIndex("by_type", (q) => q.eq("threadType", args.threadType!))
          .filter((q) => q.eq(q.field("userId"), userId))
          .order("desc")
          .collect()
      : await ctx.db
          .query("threads")
          .filter((q) => q.eq(q.field("userId"), userId))
          .order("desc")
          .collect();

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

    return threadsWithDetails;
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

export const processIncomingEmail = internalMutation({
  args: {
    subject: v.string(),
    fromParticipants: v.object({
      email: nullOrUndefinedString,
      name: nullOrUndefinedString,
    }),
    toParticipants: v.array(
      v.object({
        email: nullOrUndefinedString,
        name: nullOrUndefinedString,
      })
    ),
    externalThreadId: v.optional(v.string()),
    lastActivityAt: v.number(),
    status: threadStatus,
    externalSubscriptionId: v.string(),
    content: nullOrUndefinedString,
    hasAttachments: nullOrUndefinedBoolean,
    attachments: v.optional(
      v.union(
        v.array(
          v.object({
            id: nullOrUndefinedString,
            name: nullOrUndefinedString,
            contentBytes: nullOrUndefinedString,
            contentType: nullOrUndefinedString,
            size: nullOrUndefinedNumber,
          })
        ),
        v.null()
      )
    ),
    accessToken: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    threadId: Id<"threads">;
    emailMessageId: Id<"messages">;
    responseMessageId: Id<"messages">;
  }> => {
    const user = await ctx.runQuery(internal.users.getBySubscriptionId, {
      subscriptionId: args.externalSubscriptionId,
    });

    if (!user) {
      throw new Error("Not authenticated");
    }

    const userId = user._id;

    // try {
    // Create or update email thread
    let thread = await ctx.db
      .query("threads")
      .withIndex("by_external_subscription_id", (q) =>
        q.eq("externalSubscriptionId", args.externalSubscriptionId)
      )
      .unique();

    let threadId = thread?._id;

    if (!threadId) {
      // Create new email thread
      const newThreadId = await ctx.db.insert("threads", {
        subject: args.subject,
        fromParticipants: args.fromParticipants,
        toParticipants: args.toParticipants,
        externalThreadId: args.externalThreadId,
        lastActivityAt: args.lastActivityAt,
        status: args.status,
        threadType: "email",
        externalSubscriptionId: args.externalSubscriptionId,
        userId,
      });
      threadId = newThreadId;
    } else {
      // Update existing thread
      await ctx.db.patch(threadId, {
        lastActivityAt: args.lastActivityAt,
      });
    }

    const isSentEmail = args.fromParticipants.email === user.email;

    console.log({ content: args.content });

    // Create message for the received email
    const emailMessageId = await ctx.db.insert("messages", {
      content: args.content,
      userId,
      threadId,
      messageType: isSentEmail ? "sent_email" : "received_email",
      threadType: "email",
      role: "system",
    });

    if (emailMessageId && args.hasAttachments) {
      await ctx.scheduler.runAfter(
        0,
        internal.attachments.processEmailAttachments,
        {
          emailId: args.externalThreadId,
          messageId: emailMessageId,
          userId,
          attachments: args.attachments,
          accessToken: args.accessToken,
        }
      );
    }

    const responseMessageId = await ctx.db.insert("messages", {
      content: "",
      role: "ai",
      userId,
      threadId,
      messageType: "ai_response",
      isStreaming: true,
      streamingComplete: false,
    });

    return { threadId, emailMessageId, responseMessageId };
  },
});

export const get = internalQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.threadId);
  },
});

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
