import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "convex/_generated/api";

export function ConversationView({
  browserId,
  onSendFirstMessage,
}: {
  browserId?: string;
  onSendFirstMessage?: (content: string, uploadId?: string) => void;
}) {
  const data = useQuery(
    api.threads.getThreadByClientId,
    browserId ? { browserId } : "skip"
  );

  return (
    <div className="flex flex-col h-[calc(100vh-16px)]">
      <MessageList
        messages={data?.messages}
        threadId={data?.threadId}
        onSendFirstMessage={onSendFirstMessage}
      />
      <MessageInput
        browserId={browserId}
        threadId={data?.threadId}
        onSendFirstMessage={onSendFirstMessage}
      />
    </div>
  );
}
