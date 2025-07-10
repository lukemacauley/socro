import { useCallback, memo } from "react";
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
import { StreamingMessage } from "./StreamingMessage.client";
import type { StreamId } from "@convex-dev/persistent-text-streaming";
import { AttachmentList } from "./AttachmentList";

export const MessageList = memo(function MessageList({
  messages,
  activeStreamId,
  onStreamComplete,
}: {
  messages: (typeof api.conversations.get._returnType)["messages"];
  activeStreamId: StreamId | null;
  onStreamComplete: () => void;
}) {
  const downloadAttachment = useAction(api.webhooks.downloadAttachment);

  const handleStopStreaming = useCallback(
    (streamId: string) => {
      if (streamId === activeStreamId) {
        onStreamComplete();
      }
    },
    [activeStreamId, onStreamComplete]
  );

  const handleDownloadAttachment = useCallback(
    async (emailId: string, attachmentId: string, fileName: string) => {
      try {
        toast.info("Downloading attachment...");

        const result = await downloadAttachment({
          emailId,
          attachmentId,
        });

        if (result) {
          const byteCharacters = atob(result.content);
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
    [downloadAttachment]
  );

  return (
    <AIConversation className="max-w-3xl mx-auto">
      <AIConversationContent>
        {messages.map((m) => {
          const isAi = m.type === "ai_response";
          const isEmail = m.type === "email" || m.type === "sent_email";
          return (
            <AIMessage from={isAi ? "assistant" : "user"} key={m._id}>
              {isAi ? (
                <AIResponse>{m.content}</AIResponse>
              ) : isEmail ? (
                <AIMessageContent>
                  <div dangerouslySetInnerHTML={{ __html: m.content }} />
                  {m.attachments && m.emailId && (
                    <AttachmentList
                      attachments={m.attachments}
                      onDownload={(attachmentId, fileName) =>
                        handleDownloadAttachment(
                          m.emailId!,
                          attachmentId,
                          fileName
                        )
                      }
                    />
                  )}
                </AIMessageContent>
              ) : (
                <AIMessageContent>{m.content}</AIMessageContent>
              )}
            </AIMessage>
          );
        })}
        {!!activeStreamId && (
          <AIMessage from="assistant" key={activeStreamId}>
            <StreamingMessage
              streamId={activeStreamId}
              isDriven={!!activeStreamId}
              stopStreaming={() => handleStopStreaming(activeStreamId)}
            />
          </AIMessage>
        )}
      </AIConversationContent>
      <AIConversationScrollButton />
    </AIConversation>
  );
});
