import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  query,
  action,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import { MICROSOFT_GRAPH_BASE_URL } from "./webhooks";
import Reducto, { toFile } from "reductoai";
import { attachmentValidator } from "./lib/validators";

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

export const getAttachmentUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    return await ctx.storage.getUrl(args.storageId);
  },
});

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
    const userId = await ctx.runQuery(internal.auth.loggedInUserId);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const processedAttachments: ProcessedAttachment[] = [];

    for (const file of args.files) {
      try {
        const blob = new Blob([file.data], { type: file.type });
        const storageId = await ctx.storage.store(blob);
        const uploadUrl = await ctx.storage.getUrl(storageId);

        let parsedContent: string | null = null;

        try {
          if (!uploadUrl) {
            continue;
          }
          const reducto = new Reducto();

          const result = await reducto.parse.run({
            document_url: uploadUrl,
            options: { ocr_mode: "standard", extraction_mode: "hybrid" },
            advanced_options: {
              keep_line_breaks: true,
              ocr_system: "highres",
            },
          });

          parsedContent =
            result.result.type === "full"
              ? result.result.chunks.map((chunk) => chunk.content).join("\n\n")
              : `Document processed. Result URL: ${result.result.url}`;
        } catch (error) {
          console.error(`[REDUCTO] Error processing user upload:`, error);
        }

        // Create attachment record
        const attachmentId = await ctx.runMutation(
          internal.attachments.createAttachmentRecord,
          {
            uploadId: args.uploadId,
            userId,
            storageId,
            name: file.name,
            contentType: file.type,
            size: file.size,
            uploadStatus: "completed",
            parsedContent,
            metadata: {
              source: "chat",
              contentParsed: !!parsedContent,
              downloadedAt: Date.now(),
            },
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
  },
});

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
              microsoftAttachmentId: attachment.id,
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

export const createAttachmentRecord = internalMutation({
  args: {
    messageId: v.optional(v.id("messages")),
    uploadId: v.optional(v.string()),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    microsoftAttachmentId: v.optional(v.string()),
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
        source: v.optional(v.union(v.literal("email"), v.literal("chat"))),
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
      microsoftAttachmentId: args.microsoftAttachmentId,
      name: args.name,
      contentType: args.contentType,
      size: args.size,
      uploadStatus: args.uploadStatus,
      parsedContent: args.parsedContent,
      metadata: args.metadata,
    });
  },
});

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

    const reductoClient = new Reducto({
      apiKey: process.env.REDUCTO_API_KEY,
    });

    const file = await toFile(fileInput, attachmentName);
    const upload = await reductoClient.upload({ file });
    const result = await reductoClient.parse.run({
      document_url: upload,
      options: { ocr_mode: "standard", extraction_mode: "hybrid" },
      advanced_options: { keep_line_breaks: true, ocr_system: "highres" },
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
