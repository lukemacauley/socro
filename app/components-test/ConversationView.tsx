import type { Id } from "convex/_generated/dataModel";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";

export function ConversationView({ threadId }: { threadId: Id<"threads"> }) {
  return (
    <div>
      <MessageList threadId={threadId} />
      <MessageInput threadId={threadId} />
    </div>
  );
}
