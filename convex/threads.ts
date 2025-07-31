import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { threadStatus } from "./lib/validators";
import { paginationOptsValidator } from "convex/server";
import { authedMutation, authedQuery } from "./lib/utils";

export const getThreads = authedQuery({
  args: {
    query: v.optional(v.string()),
    threadStatus: v.optional(threadStatus),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    if (args.query) {
      return await ctx.db
        .query("threads")
        .withSearchIndex("search_body", (q) => {
          let search = q
            .search("title", args.query || "")
            .eq("userId", ctx.userId);

          // Add status filtering within the search index if specified
          // Note: For "active" status, we'll handle it differently since it means "not archived"
          if (args.threadStatus && args.threadStatus !== "active") {
            search = search.eq("status", args.threadStatus);
          }

          return search;
        })
        // For search queries, we can't efficiently handle "active" (not archived) filtering
        // in the search index, so we'll apply it as a post-filter
        .filter((q) => {
          if (args.threadStatus === "active") {
            return q.neq(q.field("status"), "archived");
          }
          return true;
        })
        .paginate(args.paginationOpts);
    }

    if (args.threadStatus !== undefined) {
      if (args.threadStatus === "active") {
        return await ctx.db
          .query("threads")
          .withIndex("by_user_id", (q) => q.eq("userId", ctx.userId))
          .filter((q) => q.neq(q.field("status"), "archived"))
          .order("desc")
          .paginate(args.paginationOpts);
      } else {
        return await ctx.db
          .query("threads")
          .withIndex("by_user_and_status", (q) =>
            q.eq("userId", ctx.userId).eq("status", args.threadStatus)
          )
          .order("desc")
          .paginate(args.paginationOpts);
      }
    } else {
      return await ctx.db
        .query("threads")
        .withIndex("by_user_id", (q) => q.eq("userId", ctx.userId))
        .order("desc")
        .paginate(args.paginationOpts);
    }
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

export const updateThreadName = authedMutation({
  args: { browserId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
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

export const getThreadByClientId = authedQuery({
  args: { browserId: v.string() },
  handler: async (ctx, args) => {
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

export const updateStatus = authedMutation({
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
