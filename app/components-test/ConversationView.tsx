import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useQuery } from "convex-helpers/react/cache";
import { ConversationHeader } from "./ConversationHeader";
import { MessageList } from "./MessageList.client";
import { MessageInput } from "./MessageInput.client";

export function ConversationView({ threadId }: { threadId: Id<"threads"> }) {
  const data = useQuery(api.threads.getThread, { id: threadId });

  if (!data) {
    return null;
  }

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col">
      <ConversationHeader
        subject={data.thread.subject}
        participants={data.thread.toParticipants}
      />
      <MessageList threadId={threadId} />
      <MessageInput threadId={threadId} />
    </div>
  );
}
