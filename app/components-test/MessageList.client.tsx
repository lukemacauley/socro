import { useCallback, memo, useMemo } from "react";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
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
  const isEmail =
    message.messageType === "received_email" ||
    message.messageType === "sent_email";

  // const downloadAttachment = useAction(api.webhooks.downloadAttachment);

  const handleDownloadAttachment = useCallback(
    async (emailId: string, attachmentId: string, fileName: string) => {
      try {
        toast.info("Downloading attachment...");

        const result = message.attachments?.find((a) => a.id === attachmentId);

        if (result) {
          const byteCharacters = atob(result.contentType); // NEEDS FIX: SHOULD BE RESULT.CONTENT
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: result.contentType });

          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          toast.success("Attachment downloaded");
        } else {
          toast.error("Failed to download attachment");
        }
      } catch (error) {
        console.error("Download error:", error);
        toast.error("Failed to download attachment");
      }
    },
    []
  );

  const displayContent = useMemo(() => {
    return message.content;
  }, [message.content]);

  return (
    <AIMessage from={isAi ? "assistant" : "user"}>
      {isAi ? (
        <AIResponse>{displayContent}</AIResponse>
      ) : isEmail ? (
        <AIMessageContent>
          <div dangerouslySetInnerHTML={{ __html: message.content }} />
          {message.attachments && message.threadId && (
            <AttachmentList
              attachments={message.attachments}
              onDownload={(attachmentId, fileName) =>
                handleDownloadAttachment(
                  message.threadId,
                  attachmentId,
                  fileName
                )
              }
            />
          )}
        </AIMessageContent>
      ) : (
        <AIMessageContent>{message.content}</AIMessageContent>
      )}
    </AIMessage>
  );
}
