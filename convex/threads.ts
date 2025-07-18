import { v } from "convex/values";
import {
  query,
  internalQuery,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
  mutation,
  internalAction,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  nullOrUndefinedBoolean,
  nullOrUndefinedNumber,
  nullOrUndefinedString,
  threadStatus,
} from "./lib/validators";
import type { DataModel, Id } from "./_generated/dataModel";
import { v4 as createId } from "uuid";

type Thread = DataModel["threads"]["document"];

export const createThread = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ctx.db.insert("threads", {
      threadId: args.threadId,
      lastActivityAt: Date.now(),
      threadType: "chat",
      userId,
    });
  },
});

export const getThreads = query({
  args: {
    threadType: v.optional(v.union(v.literal("chat"), v.literal("email"))),
    threadStatus: v.optional(threadStatus),
  },
  handler: async (ctx, args): Promise<Thread[]> => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    if (!userId) {
      return [];
    }

    let query = ctx.db
      .query("threads")
      .withIndex("by_user_id", (q) => q.eq("userId", userId));

    if (args.threadType !== undefined && args.threadType !== null) {
      query = query.filter((q) => q.eq(q.field("threadType"), args.threadType));
    }

    if (args.threadStatus !== undefined) {
      if (args.threadStatus === "active") {
        query = query.filter((q) => q.neq(q.field("status"), "archived"));
      } else {
        query = query.filter((q) => q.eq(q.field("status"), args.threadStatus));
      }
    }

    return await query.order("desc").collect();
  },
});

export const getThreadName = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_client_id", (q) => q.eq("threadId", args.id))
      .unique();

    const toParticipants = thread?.toParticipants
      ?.map((p) => p.name || p.email)
      .filter(Boolean);

    const fromParticipants = thread?.fromParticipants
      ? thread.fromParticipants.name || thread.fromParticipants.email
      : null;

    const participants = [
      ...(fromParticipants ? [fromParticipants] : []),
      ...(toParticipants || []),
    ].join(", ");

    const threadTitle = thread?.subject || "Untitled Thread";

    return participants ? `${threadTitle} - ${participants}` : threadTitle;
  },
});

export const getThread = query({
  args: { id: v.id("threads") },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    if (!userId) {
      return null;
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

    // Get streaming chunks and attachments for messages
    const messagesWithDetails = await Promise.all(
      messages.map(async (message) => {
        // Get attachments for this message
        const attachments = await ctx.db
          .query("messageAttachments")
          .withIndex("by_message_id", (q) => q.eq("messageId", message._id))
          .collect();

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
            attachments,
          };
        }
        return {
          ...message,
          attachments,
        };
      })
    );

    return {
      thread,
      messages: messagesWithDetails,
    };
  },
});

export const getThreadByClientId = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_external_id", (q) => q.eq("externalId", identity.subject))
      .unique();

    if (!user) {
      return null;
    }

    const userId = user._id;

    // Get thread by client ID
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_client_id", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();

    if (!thread) {
      return null;
    }

    // Get all messages in the thread
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_id", (q) => q.eq("threadId", thread._id))
      .order("asc")
      .collect();

    // Get streaming chunks and attachments for messages
    const messagesWithDetails = await Promise.all(
      messages.map(async (message) => {
        // Get attachments for this message
        const attachments = await ctx.db
          .query("messageAttachments")
          .withIndex("by_message_id", (q) => q.eq("messageId", message._id))
          .collect();

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
            attachments,
          };
        }
        return {
          ...message,
          attachments,
        };
      })
    );

    return {
      thread,
      messages: messagesWithDetails,
    };
  },
});

export const setIsOpened = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, { opened: true });
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
    externalSubscriptionId: v.string(),
    content: nullOrUndefinedString,
    contentPreview: nullOrUndefinedString,
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
      .withIndex("by_external_id", (q) =>
        q.eq("externalThreadId", args.externalThreadId)
      )
      .unique();

    let threadId = thread?._id;

    if (!threadId) {
      // Create new email thread
      const clientThreadId = createId();

      const newThreadId = await ctx.db.insert("threads", {
        subject: args.subject,
        threadId: clientThreadId,
        fromParticipants: args.fromParticipants,
        toParticipants: args.toParticipants,
        externalThreadId: args.externalThreadId,
        lastActivityAt: args.lastActivityAt,
        threadType: "email",
        contentPreview: args.contentPreview,
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

    // Create message for the received email
    const emailMessageId = await ctx.db.insert("messages", {
      content: args.content,
      userId,
      threadId,
      messageType: isSentEmail ? "sent_email" : "received_email",
      threadType: "email",
      role: "system",
    });

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

export const updateStatus = mutation({
  args: {
    threadId: v.id("threads"),
    status: v.optional(threadStatus),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      status: args.status,
    });
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
