import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
  action,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import { MICROSOFT_GRAPH_BASE_URL } from "./webhooks";
import Reducto, { toFile } from "reductoai";
import { attachmentValidator } from "./lib/validators";

// Types for attachment handling
interface EmailAttachmentData {
  id?: string | null;
  name?: string | null;
  contentBytes?: string | null; // Base64 encoded
  contentType?: string | null;
  size?: number | null;
}

interface ProcessedAttachment {
  storageId: Id<"_storage">;
  attachmentId: Id<"messageAttachments">;
  name: string;
  size: number;
  contentType: string;
}

// Get attachments for a message
export const getMessageAttachments = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const attachments = await ctx.db
      .query("messageAttachments")
      .withIndex("by_message_id", (q) => q.eq("messageId", args.messageId))
      .collect();

    // Get signed URLs for each attachment
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        const url = await ctx.storage.getUrl(attachment.storageId);
        return {
          ...attachment,
          url,
        };
      })
    );

    return attachmentsWithUrls;
  },
});

// Get attachment URL by storage ID
export const getAttachmentUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.getUrl(args.storageId);
  },
});

// NEW: Frontend file upload action
export const uploadUserFiles = action({
  args: {
    uploadId: v.string(),
    files: v.array(
      v.object({
        data: v.bytes(),
        name: v.string(),
        type: v.string(),
        size: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(api.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const processedAttachments: ProcessedAttachment[] = [];

    try {
      console.log(
        `[ATTACHMENTS] Processing ${args.files.length} user-uploaded files`
      );

      for (const file of args.files) {
        try {
          // Store file in Convex storage
          const blob = new Blob([file.data], { type: file.type });
          const storageId = await ctx.storage.store(blob);

          // Create attachment record
          const attachmentId = await ctx.runMutation(
            internal.attachments.createAttachmentRecord,
            {
              uploadId: args.uploadId,
              userId,
              storageId,
              externalAttachmentId: `user_upload_${Date.now()}_${Math.random()}`,
              name: file.name,
              contentType: file.type,
              size: file.size,
              uploadStatus: "completed",
              parsedContent: null, // No parsing for user uploads initially
            }
          );

          processedAttachments.push({
            storageId,
            attachmentId,
            name: file.name,
            size: file.size,
            contentType: file.type,
          });
        } catch (error) {
          console.error(
            `[ATTACHMENTS] Failed to upload file ${file.name}:`,
            error
          );
        }
      }

      return processedAttachments;
    } catch (error) {
      console.error(`[ATTACHMENTS] Failed to process user uploads:`, error);
      throw error;
    }
  },
});

// Helper function to validate and clean email attachment data
function validateEmailAttachment(att: EmailAttachmentData): {
  id: string;
  name: string;
  contentBytes: string;
  contentType: string;
  size: number;
} | null {
  // Check if all required fields are present and valid
  if (
    !att ||
    !att.contentBytes ||
    !att.contentType ||
    att.size === null ||
    att.size === undefined ||
    att.size <= 0
  ) {
    return null;
  }

  return {
    id: att.id || `attachment_${Date.now()}_${Math.random()}`,
    name: att.name || `Attachment ${Date.now()}`,
    contentBytes: att.contentBytes,
    contentType: att.contentType,
    size: att.size,
  };
}

// UPDATED: Email attachment processor with proper type handling
export const processEmailAttachments = internalAction({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    attachments: v.optional(v.union(v.array(attachmentValidator), v.null())),
    emailId: v.optional(v.string()),
    accessToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ProcessedAttachment[]> => {
    const startTime = Date.now();
    const processedAttachments: ProcessedAttachment[] = [];

    if (!args.attachments || args.attachments.length === 0) {
      console.log("[ATTACHMENTS] No attachments to process");
      return processedAttachments;
    }

    try {
      console.log(
        `[ATTACHMENTS] Processing ${args.attachments.length} email attachments for message ${args.messageId}`
      );

      // Process each attachment
      for (const rawAttachment of args.attachments) {
        // Validate and clean the attachment data
        const attachment = validateEmailAttachment(rawAttachment);

        if (!attachment) {
          console.warn(
            "[ATTACHMENTS] Skipping invalid attachment:",
            rawAttachment
          );
          continue;
        }

        try {
          const binaryData = base64ToUint8Array(attachment.contentBytes);

          // Create blob for storage
          const blob = new Blob([binaryData], { type: attachment.contentType });

          // Store in Convex storage
          const storageId = await ctx.storage.store(blob);

          // Process with Reducto if we have access token and email ID
          let parsedContent = null;
          if (args.accessToken && args.emailId) {
            try {
              parsedContent = await processAttachmentWithReducto(
                args.emailId,
                attachment.id,
                attachment.contentBytes,
                attachment.name,
                args.accessToken
              );
            } catch (error) {
              console.warn(
                `[ATTACHMENTS] Reducto processing failed for ${attachment.name}:`,
                error
              );
              // Continue without parsed content
            }
          }

          // Create attachment record
          const attachmentId = await ctx.runMutation(
            internal.attachments.createAttachmentRecord,
            {
              messageId: args.messageId,
              userId: args.userId,
              storageId,
              externalAttachmentId: attachment.id,
              name: attachment.name,
              contentType: attachment.contentType,
              size: attachment.size,
              uploadStatus: "completed",
              parsedContent,
              metadata: {
                source: "email",
                contentParsed: !!parsedContent,
                downloadedAt: Date.now(),
              },
            }
          );

          processedAttachments.push({
            storageId,
            attachmentId,
            name: attachment.name,
            size: attachment.size,
            contentType: attachment.contentType,
          });
        } catch (error) {
          console.error(
            `[ATTACHMENTS] Failed to process attachment ${attachment.name}:`,
            error
          );
        }

        const duration = Date.now() - startTime;
        console.log(
          `[ATTACHMENTS] Processed ${processedAttachments.length}/${args.attachments.length} email attachments in ${duration}ms`
        );
      }
      return processedAttachments;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `[ATTACHMENTS] Failed to process email attachments for message ${args.messageId}:`,
        error
      );

      throw error;
    }
  },
});

// Create attachment record in database
export const createAttachmentRecord = internalMutation({
  args: {
    messageId: v.optional(v.id("messages")),
    uploadId: v.optional(v.string()),
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
    parsedContent: v.optional(v.union(v.string(), v.null())),
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messageAttachments", {
      messageId: args.messageId,
      uploadId: args.uploadId,
      userId: args.userId,
      storageId: args.storageId,
      externalAttachmentId: args.externalAttachmentId,
      name: args.name,
      contentType: args.contentType,
      size: args.size,
      uploadStatus: args.uploadStatus,
      parsedContent: args.parsedContent,
      metadata: args.metadata,
    });
  },
});

// Get attachment statistics
export const getAttachmentStats = internalQuery({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const query = args.userId
      ? ctx.db
          .query("messageAttachments")
          .withIndex("by_user_id", (q) => q.eq("userId", args.userId!))
      : ctx.db.query("messageAttachments");

    const attachments = await query.collect();

    const totalSize = attachments.reduce((sum, att) => sum + att.size, 0);
    const typeStats = attachments.reduce((acc, att) => {
      const type = att.contentType.split("/")[0] || "unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAttachments: attachments.length,
      totalSize,
      averageSize: attachments.length > 0 ? totalSize / attachments.length : 0,
      typeDistribution: typeStats,
      statusDistribution: attachments.reduce((acc, att) => {
        acc[att.uploadStatus] = (acc[att.uploadStatus] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  },
});

// Clean up failed attachments
export const cleanupFailedAttachments = internalAction({
  args: { olderThanHours: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const cutoffTime =
      Date.now() - (args.olderThanHours || 24) * 60 * 60 * 1000;

    const failedAttachments = await ctx.runQuery(
      internal.attachments.getFailedAttachments,
      {
        cutoffTime,
      }
    );

    let cleanedCount = 0;
    for (const attachment of failedAttachments) {
      try {
        // Delete from storage if it exists
        try {
          await ctx.storage.delete(attachment.storageId);
        } catch (error) {
          // Storage item might not exist, continue
        }

        // Delete database record
        await ctx.runMutation(internal.attachments.deleteAttachmentRecord, {
          attachmentId: attachment._id,
        });

        cleanedCount++;
      } catch (error) {
        console.error(`Failed to cleanup attachment ${attachment._id}:`, error);
      }
    }

    console.log(`[ATTACHMENTS] Cleaned up ${cleanedCount} failed attachments`);
    return { cleanedCount };
  },
});

// Get failed attachments for cleanup
export const getFailedAttachments = internalQuery({
  args: { cutoffTime: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messageAttachments")
      .withIndex("by_upload_status", (q) => q.eq("uploadStatus", "failed"))
      .filter((q) => q.lt(q.field("_creationTime"), args.cutoffTime))
      .collect();
  },
});

// Delete attachment record
export const deleteAttachmentRecord = internalMutation({
  args: { attachmentId: v.id("messageAttachments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.attachmentId);
  },
});

// Placeholder for Reducto processing - implement based on your needs
async function processAttachmentWithReducto(
  emailId: string,
  attachmentId: string,
  attachmentBytes: string | undefined | null,
  attachmentName: string,
  accessToken: string
) {
  try {
    console.log(`[REDUCTO] Processing attachment: ${attachmentName}`);

    let bytes = attachmentBytes;

    if (!bytes) {
      if (!emailId || !attachmentId) {
        console.error("[REDUCTO] Missing emailId or attachmentId");
        return null;
      }
      // Fetch attachment content
      const response = await fetch(
        `${MICROSOFT_GRAPH_BASE_URL}/me/messages/${emailId}/attachments/${attachmentId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        console.error("[REDUCTO] Failed to fetch attachment");
        return null;
      }

      const attachmentData = await response.json();
      bytes = attachmentData.contentBytes;
    }

    if (!bytes) {
      console.error("[REDUCTO] No contentBytes found for attachment");
      return null;
    }

    const fileInput = base64ToUint8Array(bytes);

    // Initialize Reducto client
    const reductoClient = new Reducto({
      apiKey: process.env.REDUCTO_API_KEY,
    });

    // Upload and process with Reducto
    const file = await toFile(fileInput, attachmentName);
    const upload = await reductoClient.upload({ file });

    const result = await reductoClient.parse.run({
      document_url: upload,
    });

    console.log({ result });

    const content =
      result.result.type === "full"
        ? result.result.chunks.map((chunk) => chunk.content).join("\n\n")
        : `Document processed. Result URL: ${result.result.url}`;

    console.log(`[REDUCTO] Successfully processed: ${attachmentName}`);
    return content;
  } catch (error) {
    console.error(`[REDUCTO] Error processing attachment:`, error);
    return null;
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
