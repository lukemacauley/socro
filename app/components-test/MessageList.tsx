import { memo } from "react";
import { api } from "convex/_generated/api";
import {
  AIConversation,
  AIConversationContent,
  AIConversationScrollButton,
} from "~/components/kibo-ui/ai/conversation";
import { AIMessage, AIMessageContent } from "~/components/kibo-ui/ai/message";
import { AIResponse } from "~/components/kibo-ui/ai/response";
import { AttachmentList } from "./AttachmentList";
import { useQuery } from "convex-helpers/react/cache";
import { Spinner } from "~/components/kibo-ui/spinner";
import { Button } from "~/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useAction } from "convex/react";

export const MessageList = memo(function MessageList({
  threadId,
}: {
  threadId?: string;
}) {
  const thread = useQuery(
    api.threads.getThreadByClientId,
    threadId ? { threadId } : "skip"
  );

  if (!thread?.thread._id) {
    return <div className="flex-1 flex flex-col min-h-0 pt-12" />;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 pt-12">
      <AIConversation className="bg-primary-foreground">
        <AIConversationContent>
          <div className="max-w-3xl mx-auto">
            {thread.messages.map((m) => (
              <MessageItem message={m} key={m._id} />
            ))}
          </div>
        </AIConversationContent>
        <AIConversationScrollButton />
      </AIConversation>
    </div>
  );
});

function MessageItem({
  message,
}: {
  message: (typeof api.messages.getMessages._returnType)[number];
}) {
  const retryMessage = useAction(api.messages.retryMessage);

  const isAi = message.messageType === "ai_response";
  const isEmpty = !message.content || message.content.trim() === "";

  const handleRetry = async () => {
    try {
      await retryMessage({ messageId: message._id });
    } catch (error) {
      console.error("Failed to retry message:", error);
    }
  };

  return (
    <AIMessage from={isAi ? "assistant" : "user"}>
      {isEmpty ? (
        <Spinner variant="bars" />
      ) : isAi ? (
        <div className="w-full group">
          <AIResponse>{message.content}</AIResponse>
          <div className="mt-2">
            <Button
              size="icon"
              variant="ghost"
              tooltip="Retry message"
              onClick={handleRetry}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <AIMessageContent>
          <div className="whitespace-pre-wrap">{message.content}</div>
          <AttachmentList attachments={message.attachments} />
        </AIMessageContent>
      )}
    </AIMessage>
  );
}
