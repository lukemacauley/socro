import { v } from "convex/values";

export const nullOrUndefinedString = v.optional(v.union(v.string(), v.null()));
export const nullOrUndefinedBoolean = v.optional(
  v.union(v.boolean(), v.null())
);
export const nullOrUndefinedNumber = v.optional(v.union(v.number(), v.null()));

// Single source of truth for conversation status
export const threadStatus = v.union(v.literal("pinned"), v.literal("archived"));

// Single source of truth for message types
export const messageType = v.union(
  v.literal("sent_email"),
  v.literal("received_email"),
  v.literal("ai_response"),
  v.literal("user_message")
);

// Attachment object validator
export const attachmentValidator = v.object({
  id: nullOrUndefinedString,
  name: nullOrUndefinedString,
  contentBytes: nullOrUndefinedString,
  contentType: nullOrUndefinedString,
  size: nullOrUndefinedNumber,
});

export const emailParticipant = v.object({
  email: v.optional(v.union(v.string(), v.null())),
  name: v.optional(v.union(v.string(), v.null())),
});
