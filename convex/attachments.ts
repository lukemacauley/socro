import { v } from "convex/values";
import { internalMutation, query, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import Reducto, { toFile } from "reductoai";
import { authedAction } from "./lib/utils";

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

export const uploadUserFiles = authedAction({
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
    const processedAttachments: ProcessedAttachment[] = [];

    for (const file of args.files) {
      try {
        const blob = new Blob([file.data], { type: file.type });
        const storageId = await ctx.storage.store(blob);
        const uploadUrl = await ctx.storage.getUrl(storageId);

        let parsedContent: string | undefined = undefined;

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
            userId: ctx.userId,
            storageId,
            name: file.name,
            contentType: file.type,
            size: file.size,
            uploadStatus: "completed",
            parsedContent,
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

export const createAttachmentRecord = internalMutation({
  args: {
    messageId: v.optional(v.id("messages")),
    uploadId: v.optional(v.string()),
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
    parsedContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messageAttachments", {
      messageId: args.messageId,
      uploadId: args.uploadId,
      userId: args.userId,
      storageId: args.storageId,
      name: args.name,
      contentType: args.contentType,
      size: args.size,
      uploadStatus: args.uploadStatus,
      parsedContent: args.parsedContent,
    });
  },
});
