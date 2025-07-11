import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  threadStatus,
  emailParticipant,
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
    externalSubscriptionId: v.optional(v.string()),
    responseTemplate: v.optional(v.string()),
  })
    .index("by_external_id", ["externalId"])
    .index("by_subscription_id", ["externalSubscriptionId"])
    .index("by_email", ["email"]),

  threads: defineTable({
    threadType: v.union(v.literal("chat"), v.literal("email")),
    externalThreadId: v.string(), // Microsoft Graph conversation ID
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
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("ai"), v.literal("system")),
    messageType: messageType,
    attachments: v.optional(v.array(attachmentValidator)),
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

// ====== //
// FOR MICROSOFT EMAILS
// ====== //

// Helper schemas for nested types
const recipientSchema = v.object({
  emailAddress: v.optional(
    v.object({
      name: v.optional(v.string()),
      address: v.optional(v.string()),
    })
  ),
});

const itemBodySchema = v.object({
  contentType: v.optional(v.string()), // "text" or "html"
  content: v.optional(v.string()),
});

export const attachmentSchema = v.object({
  id: v.string(),
  name: v.optional(v.string()),
  contentType: v.optional(v.string()),
  size: v.optional(v.number()),
  isInline: v.optional(v.boolean()),
  lastModifiedDateTime: v.optional(v.string()),
  contentId: v.optional(v.string()),
  contentLocation: v.optional(v.string()),
  contentBytes: v.optional(v.string()), // Base64 encoded
});

// Main Message schema (includes OutlookItem properties)
export const outlookEmailSchema = v.object({
  id: v.optional(v.string()),
  categories: v.optional(v.array(v.string())),
  // Message specific properties
  bccRecipients: v.optional(v.array(recipientSchema)),
  body: v.optional(itemBodySchema),
  bodyPreview: v.optional(v.string()),
  ccRecipients: v.optional(v.array(recipientSchema)),
  conversationId: v.optional(v.string()),
  conversationIndex: v.optional(v.string()),
  from: v.optional(recipientSchema),
  hasAttachments: v.optional(v.boolean()),
  internetMessageId: v.optional(v.string()),
  receivedDateTime: v.optional(v.string()),
  sender: v.optional(recipientSchema),
  sentDateTime: v.optional(v.string()),
  subject: v.optional(v.string()),
  toRecipients: v.optional(v.array(recipientSchema)),
  uniqueBody: v.optional(itemBodySchema),
  // Navigation properties
  attachments: v.optional(v.array(attachmentSchema)),
});
