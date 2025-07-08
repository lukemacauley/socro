import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  conversationStatus,
  messageType,
  attachmentValidator,
} from "./lib/validators";

const applicationTables = {
  users: defineTable({
    name: v.string(),
    email: v.string(),
    externalId: v.string(), // Clerk user ID
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    lastActiveAt: v.optional(v.number()),
  })
    .index("by_external_id", ["externalId"])
    .index("by_email", ["email"]),

  conversations: defineTable({
    threadId: v.string(), // Microsoft Graph conversation ID - unique thread identifier
    userId: v.id("users"),
    subject: v.string(),
    status: conversationStatus,
    // Thread metadata
    initialEmailId: v.string(), // ID of the first email in the thread
    latestEmailId: v.string(), // ID of the most recent email
    participants: v.array(
      v.object({
        email: v.string(),
        name: v.optional(v.string()),
      })
    ),
    createdAt: v.number(),
    lastActivity: v.number(),
    agentThreadId: v.optional(v.string()), // ID for the AI agent thread if applicable
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_thread", ["threadId", "userId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    content: v.string(),
    type: messageType,
    sender: v.optional(v.string()), // email sender or "ai" or user ID
    timestamp: v.number(),
    emailId: v.optional(v.string()), // Microsoft Graph message ID if applicable
    attachments: v.optional(v.array(attachmentValidator)),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_email_id", ["emailId"]),

  userSettings: defineTable({
    userId: v.id("users"),
    webhookSubscriptionId: v.optional(v.string()),
    autoResponseEnabled: v.boolean(),
    responseTemplate: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  processedAttachments: defineTable({
    conversationId: v.id("conversations"),
    attachmentId: v.string(),
    attachmentName: v.string(),
    content: v.string(),
    metadata: v.optional(
      v.object({
        pageCount: v.optional(v.number()),
        processingTime: v.optional(v.number()),
      })
    ),
    processedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_attachment_id", ["attachmentId"]),
};

export default defineSchema({
  ...applicationTables,
});
