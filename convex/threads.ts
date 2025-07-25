import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { threadStatus } from "./lib/validators";
import { paginationOptsValidator } from "convex/server";

export const getThreads = query({
  args: {
    threadStatus: v.optional(threadStatus),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    let query = ctx.db
      .query("threads")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id));

    if (args.threadStatus !== undefined) {
      if (args.threadStatus === "active") {
        query = query.filter((q) => q.neq(q.field("status"), "archived"));
      } else {
        query = query.filter((q) => q.eq(q.field("status"), args.threadStatus));
      }
    }

    return await query.order("desc").paginate(args.paginationOpts);
  },
});

export const getThreadName = query({
  args: { browserId: v.string() },
  handler: async (ctx, args) => {
    const EMPTY_TITLE = "Untitled Thread";

    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return EMPTY_TITLE;
    }

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_browser_id", (q) => q.eq("browserId", args.browserId))
      .unique();

    if (!thread) {
      return EMPTY_TITLE;
    }

    return thread.title || EMPTY_TITLE;
  },
});

export const updateThreadName = mutation({
  args: { browserId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_browser_id", (q) => q.eq("browserId", args.browserId))
      .unique();

    if (!thread?._id) {
      throw new Error(`Thread not found: ${args.browserId}`);
    }

    await ctx.db.patch(thread._id, {
      title: args.name,
    });
  },
});

export const getThreadByClientId = query({
  args: { browserId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_browser_id", (q) => q.eq("browserId", args.browserId))
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
