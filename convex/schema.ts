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
    contentPreview: nullOrUndefinedString,
    fromParticipants: emailParticipant,
    toParticipants: v.array(emailParticipant),
    lastActivityAt: v.number(),
    status: v.optional(threadStatus),
    processed: v.optional(v.boolean()),
  })
    .index("by_user_id", ["userId"])
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
    messageId: v.optional(v.id("messages")),
    uploadId: v.optional(v.string()), // For frontend uploads"
    userId: v.id("users"),
    storageId: v.id("_storage"),
    externalAttachmentId: v.string(),
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
        source: v.optional(
          v.union(v.literal("email"), v.literal("user_upload"))
        ),
        contentParsed: v.optional(v.boolean()),
        parsingError: v.optional(v.string()),
      })
    ),
  })
    .index("by_message_id", ["messageId"])
    .index("by_user_id", ["userId"])
    .index("by_storage_id", ["storageId"])
    .index("by_upload_status", ["uploadStatus"])
    .index("by_external_attachment_id", ["externalAttachmentId"]),

  userWritingStyles: defineTable({
    userId: v.id("users"),
    analysisDate: v.number(),
    emailsAnalyzed: v.number(),
    
    // Tone and formality
    formalityLevel: v.union(
      v.literal("very_formal"),
      v.literal("formal"),
      v.literal("semi_formal"),
      v.literal("casual"),
      v.literal("very_casual")
    ),
    
    // Common greetings and closings
    greetings: v.array(v.string()), // e.g., ["Hi", "Hello", "Dear", "Hey"]
    closings: v.array(v.string()), // e.g., ["Best regards", "Thanks", "Cheers", "Sincerely"]
    
    // Sentence patterns
    averageSentenceLength: v.number(),
    usesContractions: v.boolean(), // e.g., "I'll" vs "I will"
    sentenceStarters: v.array(v.string()), // Common ways they start sentences
    
    // Vocabulary and phrases
    commonPhrases: v.array(v.string()), // Frequently used phrases
    signaturePhrases: v.array(v.string()), // Unique phrases that identify their style
    professionalTerms: v.array(v.string()), // Industry-specific terms they use
    
    // Email structure preferences
    usesNumberedLists: v.boolean(),
    usesBulletPoints: v.boolean(),
    paragraphStyle: v.union(v.literal("short"), v.literal("medium"), v.literal("long")),
    
    // Communication patterns
    directness: v.union(v.literal("very_direct"), v.literal("direct"), v.literal("balanced"), v.literal("indirect")),
    emotionalTone: v.union(v.literal("warm"), v.literal("neutral"), v.literal("professional"), v.literal("formal")),
    
    // Example emails for reference
    exampleEmails: v.array(
      v.object({
        recipient: v.string(), // To understand context-based style changes
        content: v.string(),
        context: v.optional(v.string()), // e.g., "client", "colleague", "team"
      })
    ),
    
    // Style variations by recipient type
    styleByRecipient: v.optional(
      v.object({
        clients: v.optional(v.object({
          formalityLevel: v.string(),
          commonPhrases: v.array(v.string()),
        })),
        colleagues: v.optional(v.object({
          formalityLevel: v.string(),
          commonPhrases: v.array(v.string()),
        })),
        internal: v.optional(v.object({
          formalityLevel: v.string(),
          commonPhrases: v.array(v.string()),
        })),
      })
    ),
  })
    .index("by_user_id", ["userId"]),
};

export default defineSchema({
  ...applicationTables,
});
