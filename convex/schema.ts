import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  threadStatus,
  emailParticipant,
  messageType,
  attachmentValidator,
  nullOrUndefinedString,
} from "./lib/validators";

const applicationTables = {
  users: defineTable({
    name: v.string(),
    email: v.string(),
    externalId: v.string(), // Clerk user ID
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    lastActiveAt: v.optional(v.number()),
    externalSubscriptionId: v.optional(v.string()),
    responseTemplate: v.optional(v.string()),
  })
    .index("by_external_id", ["externalId"])
    .index("by_subscription_id", ["externalSubscriptionId"])
    .index("by_email", ["email"]),

  threads: defineTable({
    threadType: v.union(v.literal("chat"), v.literal("email")),
    externalThreadId: v.optional(v.string()), // Microsoft Graph conversation ID
    externalSubscriptionId: v.optional(v.string()),
    userId: v.id("users"),
    subject: v.string(),
    fromParticipants: emailParticipant,
    toParticipants: v.array(emailParticipant),
    lastActivityAt: v.number(),
    status: v.optional(threadStatus),
    processed: v.optional(v.boolean()),
  })
    .index("by_user_ud", ["userId"])
    .index("by_status", ["status"])
    .index("by_external_id", ["externalThreadId"])
    .index("by_external_subscription_id", ["externalSubscriptionId"])
    .index("by_type", ["threadType"])
    .index("by_processed", ["processed"]),

  messages: defineTable({
    threadId: v.id("threads"),
    userId: v.id("users"),
    content: nullOrUndefinedString,
    role: v.union(v.literal("user"), v.literal("ai"), v.literal("system")),
    messageType: messageType,
    attachments: v.optional(v.union(v.array(attachmentValidator), v.null())),
    isStreaming: v.optional(v.boolean()),
    streamingComplete: v.optional(v.boolean()),
    threadType: v.optional(v.union(v.literal("chat"), v.literal("email"))),
  })
    .index("by_thread_id", ["threadId"])
    .index("by_type", ["threadType"])
    .index("by_user_id", ["userId"]),

  streamingChunks: defineTable({
    messageId: v.id("messages"),
    chunk: v.string(),
    chunkIndex: v.number(),
  }).index("by_message", ["messageId", "chunkIndex"]),

  messageAttachments: defineTable({
    messageId: v.id("messages"),
    attachmentId: v.string(),
    attachmentName: v.string(),
    content: v.string(),
    metadata: v.optional(
      v.object({
        pageCount: v.optional(v.number()),
        processingTime: v.optional(v.number()),
      })
    ),
    createdAt: v.number(),
  })
    .index("by_message_id", ["messageId"])
    .index("by_attachment_id", ["attachmentId"]),
};

export default defineSchema({
  ...applicationTables,
});
