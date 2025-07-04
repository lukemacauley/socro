import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    emailId: v.string(), // Microsoft Graph email ID
    subject: v.string(),
    fromEmail: v.string(),
    fromName: v.optional(v.string()),
    userId: v.id("users"),
    status: v.union(
      v.literal("new"),
      v.literal("in_progress"),
      v.literal("resolved")
    ),
    lastActivity: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_email_id", ["emailId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    content: v.string(),
    type: v.union(
      v.literal("email"),
      v.literal("ai_response"),
      v.literal("user_note")
    ),
    sender: v.optional(v.string()), // email sender or "ai" or user ID
    timestamp: v.number(),
    emailId: v.optional(v.string()), // Microsoft Graph message ID if applicable
    attachments: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      contentType: v.string(),
      size: v.number(),
    }))),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_timestamp", ["timestamp"]),

  userSettings: defineTable({
    userId: v.id("users"),
    webhookSubscriptionId: v.optional(v.string()),
    autoResponseEnabled: v.boolean(),
    responseTemplate: v.optional(v.string()),
  }).index("by_user", ["userId"]),
};

export default defineSchema({
  ...applicationTables,
});
