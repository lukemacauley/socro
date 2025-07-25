import { v } from "convex/values";

export const nullOrUndefinedString = v.optional(v.union(v.string(), v.null()));
export const nullOrUndefinedBoolean = v.optional(
  v.union(v.boolean(), v.null())
);
export const nullOrUndefinedNumber = v.optional(v.union(v.number(), v.null()));

export const threadStatus = v.union(
  v.literal("active"),
  v.literal("pinned"),
  v.literal("archived")
);

// Attachment object validator
export const attachmentValidator = v.object({
  id: nullOrUndefinedString,
  name: nullOrUndefinedString,
  contentBytes: nullOrUndefinedString,
  contentType: nullOrUndefinedString,
  size: nullOrUndefinedNumber,
});
