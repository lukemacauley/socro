import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { threadStatus } from "./lib/validators";

const applicationTables = {
  users: defineTable({
    name: v.string(),
    email: v.string(),
    organisationId: v.optional(v.id("organisations")),
    workOSId: v.optional(v.string()),
    clerkId: v.optional(v.string()), // Deprecated, use workOSId instead
    imageUrl: v.optional(v.string()),
    lastActivityAt: v.optional(v.number()),
    role: v.optional(
      v.union(v.literal("partner"), v.literal("associate"), v.literal("admin"))
    ),
  })
    .index("by_workos_id", ["workOSId"])
    .index("by_clerk_id", ["clerkId"])
    .index("by_organisation_id", ["organisationId"]),
  organisations: defineTable({
    name: v.string(),
    workOSId: v.string(), // WorkOS organization ID
    slug: v.optional(v.string()),
  }).index("by_workos_id", ["workOSId"]),
  threads: defineTable({
    browserId: v.optional(v.string()), // UUID for instant client navigation
    userId: v.id("users"),
    title: v.optional(v.string()),
    contentPreview: v.optional(v.string()),
    practiceArea: v.optional(v.string()), // "corporate", "litigation", etc.
    difficulty: v.optional(v.number()), // 1-5
    lastActivityAt: v.number(),
    status: v.optional(threadStatus),
  })
    .index("by_user_id", ["userId"])
    .index("by_status", ["status"])
    .index("by_browser_id", ["browserId"]),
  messages: defineTable({
    threadId: v.id("threads"),
    userId: v.id("users"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("ai")),
    type: v.union(v.literal("ai"), v.literal("user"), v.literal("evaluation")),
    isStreaming: v.optional(v.boolean()),
    streamingComplete: v.optional(v.boolean()),
  })
    .index("by_thread_id", ["threadId"])
    .index("by_user_id", ["userId"]),

  messageAttachments: defineTable({
    messageId: v.optional(v.id("messages")),
    threadId: v.optional(v.id("threads")), // Get all attachments in a thread
    uploadId: v.optional(v.string()), // UUID for frontend uploads
    userId: v.id("users"),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    uploadStatus: v.union(
      v.literal("pending"),
      v.literal("uploading"),
      v.literal("completed"),
      v.literal("failed")
    ),
    parsedContent: v.optional(v.string()), // For parsed content from Reducto
  })
    .index("by_message_id", ["messageId"])
    .index("by_thread_id", ["threadId"])
    .index("by_upload_id", ["uploadId"]),
  userStats: defineTable({
    userId: v.id("users"),
    scenariosCompleted: v.optional(v.number()),
    scenariosStarted: v.optional(v.number()),
    totalPoints: v.optional(v.number()),
    averageScore: v.optional(v.number()),
    currentStreak: v.optional(v.number()),
    bestStreak: v.optional(v.number()),
  })
    .index("by_total_points", ["totalPoints"])
    .index("by_user_id", ["userId"]),
};

export default defineSchema({
  ...applicationTables,
});
