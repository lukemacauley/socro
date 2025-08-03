import { v } from "convex/values";
import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import Reducto from "reductoai";
import { authedAction, authedQuery } from "./lib/utils";

export const getAttachmentUrl = authedQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
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
    for (const file of args.files) {
      try {
        const blob = new Blob([file.data], { type: file.type });
        const storageId = await ctx.storage.store(blob);
        const uploadUrl = await ctx.storage.getUrl(storageId);

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

        let parsedContentStorageId: Id<"_storage">;

        if (result.result.type === "full") {
          const parsedContent = result.result.chunks
            .map((chunk) => chunk.content)
            .join("\n\n");

          const parsedBlob = new Blob([parsedContent], { type: "text/plain" });
          parsedContentStorageId = await ctx.storage.store(parsedBlob);
        } else {
          parsedContentStorageId = await ctx.runAction(
            internal.attachments.processUrlContent,
            {
              url: result.result.url,
            }
          );
        }

        await ctx.runMutation(internal.attachments.createAttachmentRecord, {
          uploadId: args.uploadId,
          userId: ctx.userId,
          storageId,
          name: file.name,
          contentType: file.type,
          size: file.size,
          uploadStatus: "completed",
          parsedContentStorageId,
        });
      } catch (error) {
        console.error(
          `[ATTACHMENTS] Failed to upload file ${file.name}:`,
          error
        );
      }
    }
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
    parsedContentStorageId: v.id("_storage"),
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
      parsedContentStorageId: args.parsedContentStorageId,
    });
  },
});

export const processUrlContent = internalAction({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const response = await fetch(args.url);

      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`);
      }

      const content = await response.text();
      const blob = new Blob([content], { type: "text/plain" });
      return await ctx.storage.store(blob);
    } catch (error) {
      console.error(`[ATTACHMENTS] Failed to process URL content:`, error);
      throw error;
    }
  },
});
