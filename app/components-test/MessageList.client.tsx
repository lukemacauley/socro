import { memo, useMemo } from "react";
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
import type { Id } from "convex/_generated/dataModel";

export const MessageList = memo(function MessageList({
  threadId,
}: {
  threadId: Id<"threads">;
}) {
  const messages = useQuery(api.messages.getMessages, { threadId }) || [];

  return (
    <AIConversation className="bg-primary-foreground max-w-3xl mx-auto">
      <AIConversationContent>
        {messages.map((m) => (
          <MessageItem message={m} key={m._id} />
        ))}
      </AIConversationContent>
      <AIConversationScrollButton />
    </AIConversation>
  );
});

function MessageItem({
  message,
}: {
  message: (typeof api.messages.getMessages._returnType)[number];
}) {
  const isAi = message.messageType === "ai_response";

  const displayContent = useMemo(() => {
    return message.content;
  }, [message.content]);

  return (
    <AIMessage from={isAi ? "assistant" : "user"}>
      {isAi ? (
        <AIResponse>{displayContent}</AIResponse>
      ) : (
        <AIMessageContent className="whitespace-pre-wrap">
          {message.content}
          <AttachmentList attachments={message.attachments} />
        </AIMessageContent>
      )}
    </AIMessage>
  );
}
