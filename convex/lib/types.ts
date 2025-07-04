import { type Doc } from "../_generated/dataModel";

export type ConversationStatus = "new" | "in_progress" | "resolved";

export type ConversationWithLatestMessage = Doc<"conversations"> & {
  latestMessage: Doc<"messages"> | null;
};
