import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";

export function ConversationView({
  threadId,
  onSendFirstMessage,
}: {
  threadId?: string;
  onSendFirstMessage?: (content: string, uploadId?: string) => void;
}) {
  return (
    <div className="flex flex-col h-screen">
      <MessageList threadId={threadId} />
      <MessageInput
        threadId={threadId}
        onSendFirstMessage={onSendFirstMessage}
      />
    </div>
  );
}
