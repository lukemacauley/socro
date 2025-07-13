import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import { attachmentValidator } from "./lib/validators";
import { MICROSOFT_GRAPH_BASE_URL } from "./webhooks";
import Reducto, { toFile } from "reductoai";

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
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Process multiple attachments for an email message
export const processEmailAttachments = internalAction({
  args: {
    emailId: v.optional(v.string()),
    messageId: v.id("messages"),
    userId: v.id("users"),
    accessToken: v.string(),
    attachments: v.optional(v.union(v.array(attachmentValidator), v.null())),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const processedAttachments: ProcessedAttachment[] = [];

    if (!args.attachments || args.attachments.length === 0) {
      console.log("[ATTACHMENTS] No attachments to process");
      return;
    }

    console.log(
      `[ATTACHMENTS] Processing ${args.attachments.length} attachments for message ${args.messageId}`
    );

    // Process each attachment
    for (const att of args.attachments) {
      if (!att || !att.contentBytes || !att.contentType) {
        console.warn("[ATTACHMENTS] Skipping invalid attachment:", att);
        continue;
      }

      try {
        // Decode base64 content
        const binaryData = Buffer.from(att.contentBytes, "base64");
        // Create blob for storage
        const blob = new Blob([binaryData], { type: att.contentType });
        // Store in Convex storage
        const storageId = await ctx.storage.store(blob);

        const name = att.name || `Attachment ${Date.now()}`;

        const reductoContent = await processAttachmentWithReducto(
          args.emailId,
          att.id || "",
          att.contentBytes,
          name,
          args.accessToken
        );

        // Create attachment record
        const attachmentId = await ctx.runMutation(
          internal.attachments.createAttachmentRecord,
          {
            messageId: args.messageId,
            userId: args.userId,
            storageId,
            externalAttachmentId: att.id || "",
            name,
            parsedContent: reductoContent,
            contentType: att.contentType || "application/pdf",
            size: att.size || 0,
            uploadStatus: "completed",
          }
        );

        processedAttachments.push({
          storageId,
          attachmentId,
          name,
          size: att.size || 0,
          contentType: att.contentType,
        });
      } catch (error) {
        console.error(
          `[ATTACHMENTS] Failed to process attachment ${att.name}:`,
          error
        );
      }

      const duration = Date.now() - startTime;
      console.log(
        `[ATTACHMENTS] Processed ${processedAttachments.length}/${args.attachments.length} attachments in ${duration}ms`
      );

      return processedAttachments;
    }
  },
});

// Create attachment record in database
export const createAttachmentRecord = internalMutation({
  args: {
    messageId: v.id("messages"),
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
    parsedContent: v.union(v.string(), v.null()),
    metadata: v.optional(
      v.object({
        pageCount: v.optional(v.number()),
        processingTime: v.optional(v.number()),
        originalUrl: v.optional(v.string()),
        downloadedAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messageAttachments", {
      messageId: args.messageId,
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

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// export const sendFile = mutation({
//   args: {
//     messageId: v.id("messages"),
//     storageId: v.id("_storage"),
//     author: v.string(),
//     fileType: v.string(),
//   },
//   handler: async (ctx, args) => {
//     const userId = await ctx.runQuery(api.auth.loggedInUserId);
//     await ctx.db.insert("messageAttachments", {
//       storageId: args.storageId,
//       userId: userId,
//       contentType: args.fileType,
//       uploadStatus: "pending",
//       size,
//     });
//   },
// });

export async function processAttachmentWithReducto(
  emailId: string | undefined,
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
