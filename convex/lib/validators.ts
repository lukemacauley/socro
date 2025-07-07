import { v } from "convex/values";

// Single source of truth for conversation status
export const conversationStatus = v.union(
  v.literal("new"),
  v.literal("in_progress"),
  v.literal("resolved")
);

// Single source of truth for message types
export const messageType = v.union(
  v.literal("email"),
  v.literal("sent_email"),
  v.literal("ai_response"),
  v.literal("user_note")
);

// Attachment object validator
export const attachmentValidator = v.object({
  id: v.string(),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
});