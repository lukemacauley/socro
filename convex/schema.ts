import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  threadStatus,
  emailParticipant,
  messageType,
  nullOrUndefinedString,
} from "./lib/validators";

const applicationTables = {
  users: defineTable({
    name: v.string(),
    email: v.string(),
    clerkId: v.string(),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    lastActiveAt: v.optional(v.number()),
    microsoftSubscriptionId: v.optional(v.string()),
    responseTemplate: v.optional(v.string()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_microsoft_subscription_id", ["microsoftSubscriptionId"])
    .index("by_email", ["email"]),

  threads: defineTable({
    threadId: v.optional(v.string()), // UUID for instant client navigation
    microsoftThreadId: v.optional(v.string()), // Microsoft Graph conversation ID
    userId: v.id("users"),
    subject: v.optional(v.string()),
    contentPreview: nullOrUndefinedString,
    fromParticipants: v.optional(emailParticipant),
    toParticipants: v.optional(v.array(emailParticipant)),
    lastActivityAt: v.number(),
    status: v.optional(threadStatus),
    opened: v.optional(v.boolean()),
    type: v.union(v.literal("chat"), v.literal("email")),
  })
    .index("by_user_id", ["userId"])
    .index("by_status", ["status"])
    .index("by_microsoft_thread_id", ["microsoftThreadId"])
    .index("by_client_thread_id", ["threadId"]),
  messages: defineTable({
    threadId: v.id("threads"),
    userId: v.id("users"),
    content: nullOrUndefinedString,
    role: v.union(v.literal("user"), v.literal("ai"), v.literal("system")),
    type: messageType,
    isStreaming: v.optional(v.boolean()),
    streamingComplete: v.optional(v.boolean()),
  })
    .index("by_thread_id", ["threadId"])
    .index("by_user_id", ["userId"]),

  streamingChunks: defineTable({
    messageId: v.id("messages"),
    chunk: v.string(),
    chunkIndex: v.number(),
  }).index("by_message", ["messageId", "chunkIndex"]),

  messageAttachments: defineTable({
    messageId: v.optional(v.id("messages")), // Attachments can be linked to messages
    uploadId: v.optional(v.string()), // UUID for frontend uploads
    threadId: v.optional(v.id("threads")), // Get all attachments in a thread
    userId: v.id("users"),
    storageId: v.id("_storage"), // Storage ID for the file in Convex storage
    microsoftAttachmentId: v.optional(v.string()), // For Microsoft Graph attachments to query later
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    uploadStatus: v.union(
      v.literal("pending"),
      v.literal("uploading"),
      v.literal("completed"),
      v.literal("failed")
    ),
    parsedContent: nullOrUndefinedString, // For parsed content from Reducto
    metadata: v.optional(
      v.object({
        pageCount: v.optional(v.number()),
        processingTime: v.optional(v.number()),
        originalUrl: v.optional(v.string()),
        downloadedAt: v.optional(v.number()),
        source: v.optional(v.union(v.literal("email"), v.literal("chat"))),
        contentParsed: v.optional(v.boolean()),
        parsingError: v.optional(v.string()),
      })
    ),
  })
    .index("by_message_id", ["messageId"])
    .index("by_thread_id", ["threadId"])
    .index("by_upload_id", ["uploadId"]),
};

export default defineSchema({
  ...applicationTables,
});
