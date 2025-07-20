import { v } from "convex/values";
import { query, internalMutation, mutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  nullOrUndefinedBoolean,
  nullOrUndefinedNumber,
  nullOrUndefinedString,
  threadStatus,
} from "./lib/validators";
import type { DataModel, Id } from "./_generated/dataModel";
import { v7 as createId } from "uuid";

type Thread = DataModel["threads"]["document"];

export const createThread = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(internal.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ctx.db.insert("threads", {
      threadId: args.threadId,
      lastActivityAt: Date.now(),
      type: "chat",
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
    const userId = await ctx.runQuery(internal.auth.loggedInUserId);
    if (!userId) {
      return [];
    }

    let query = ctx.db
      .query("threads")
      .withIndex("by_user_id", (q) => q.eq("userId", userId));

    if (args.threadType !== undefined && args.threadType !== null) {
      query = query.filter((q) => q.eq(q.field("type"), args.threadType));
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
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return "Untitled Thread";
    }

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_client_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!thread) {
      return "Untitled Thread";
    }

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

export const updateThreadName = mutation({
  args: { threadId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_client_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!thread?._id) {
      throw new Error(`Thread not found: ${args.threadId}`);
    }

    await ctx.db.patch(thread._id, {
      subject: args.name,
    });
  },
});

export const getThreadByClientId = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_client_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!thread) {
      return null;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_id", (q) => q.eq("threadId", thread._id))
      .order("asc")
      .collect();

    const attachments = await ctx.db
      .query("messageAttachments")
      .withIndex("by_thread_id", (q) => q.eq("threadId", thread._id))
      .collect();

    const messagesWithAttachments = messages.map((message) => {
      const messageAttachments = attachments.filter(
        (attachment) => attachment.messageId === message._id
      );

      return {
        ...message,
        attachments: messageAttachments,
      };
    });

    return { threadId: thread._id, messages: messagesWithAttachments };
  },
});

export const setIsOpened = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

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
    microsoftThreadId: v.optional(v.string()),
    lastActivityAt: v.number(),
    microsoftSubscriptionId: v.string(),
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
      subscriptionId: args.microsoftSubscriptionId,
    });

    if (!user) {
      throw new Error("Not authenticated");
    }

    const userId = user._id;

    // try {
    // Create or update email thread
    let thread = await ctx.db
      .query("threads")
      .withIndex("by_microsoft_thread_id", (q) =>
        q.eq("microsoftThreadId", args.microsoftThreadId)
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
        microsoftThreadId: args.microsoftThreadId,
        lastActivityAt: args.lastActivityAt,
        type: "email",
        contentPreview: args.contentPreview,
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
      type: isSentEmail ? "sent_email" : "received_email",
      role: "system",
    });

    const responseMessageId = await ctx.db.insert("messages", {
      content: "",
      role: "ai",
      userId,
      threadId,
      type: "ai_response",
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
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(args.threadId, {
      status: args.status,
    });
  },
});
