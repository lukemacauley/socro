import { v } from "convex/values";

// Single source of truth for conversation status
export const threadStatus = v.union(
  v.literal("new"),
  v.literal("in_progress"),
  v.literal("archived")
);

// Single source of truth for message types
export const messageType = v.union(
  v.literal("sent_email"),
  v.literal("received_email"),
  v.literal("ai_response"),
  v.literal("user_message")
);

// Attachment object validator
export const attachmentValidator = v.object({
  id: v.string(),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
});

export const emailParticipant = v.object({
  email: v.string(),
  name: v.optional(v.string()),
});
