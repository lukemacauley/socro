import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "convex/_generated/api";

export function ConversationView({
  clientThreadId,
  onSendFirstMessage,
}: {
  clientThreadId?: string;
  onSendFirstMessage?: (content: string, uploadId?: string) => void;
}) {
  const data = useQuery(
    api.threads.getThreadByClientId,
    clientThreadId ? { browserId: clientThreadId } : "skip"
  );

  return (
    <div className="flex flex-col h-screen">
      <MessageList messages={data?.messages} threadId={data?.threadId} />
      <MessageInput
        clientThreadId={clientThreadId}
        threadId={data?.threadId}
        onSendFirstMessage={onSendFirstMessage}
      />
    </div>
  );
}
