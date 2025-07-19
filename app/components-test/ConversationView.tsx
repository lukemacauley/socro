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
    clientThreadId ? { threadId: clientThreadId } : "skip"
  );

  return (
    <div className="flex flex-col h-screen">
      <MessageList messages={data?.messages} />
      <MessageInput
        clientThreadId={clientThreadId}
        threadId={data?.thread._id}
        onSendFirstMessage={onSendFirstMessage}
      />
    </div>
  );
}
