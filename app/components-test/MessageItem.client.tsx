import { memo } from "react";
import { cn } from "~/lib/utils";
import { StreamingMessage } from "./StreamingMessage.client";
import { AttachmentList } from "./AttachmentList";

interface MessageItemProps {
  message: any;
  isDriven: boolean;
  isLast: boolean;
  isStreaming: boolean;
  activeStreamId: string | null;
  onStopStreaming: () => void;
  onDownloadAttachment: (
    emailId: string,
    attachmentId: string,
    fileName: string
  ) => void;
}

export const MessageItem = memo(function MessageItem({
  message,
  isDriven,
  isLast,
  isStreaming,
  activeStreamId,
  onStopStreaming,
  onDownloadAttachment,
}: MessageItemProps) {
  const isUserMessage =
    message.type === "sent_email" || message.type === "user_note";
  const isEmailMessage =
    message.type === "email" || message.type === "sent_email";

  return (
    <div
      className={cn(
        "flex",
        isLast && !activeStreamId && !isStreaming
          ? "min-h-[calc(100vh-20rem)]"
          : "",
        isUserMessage ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={
          ["email", "sent_email", "user_note"].includes(message.type)
            ? "max-w-4/5"
            : "w-full"
        }
      >
        <div
          className={cn(
            "rounded-lg p-4",
            message.type === "email"
              ? "w-full bg-blue-50 border border-zinc-200"
              : message.type === "sent_email"
              ? "w-full bg-blue-50 border border-zinc-200"
              : message.type === "user_note"
              ? "w-full bg-blue-50 border border-zinc-200"
              : message.type === "ai_response"
              ? "w-full p-0 border-zinc-200"
              : "w-full"
          )}
        >
          {isEmailMessage && (
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {message.type === "email" ? "Received" : "Sent"}
                </span>
                {message.sender && (
                  <span className="text-xs text-zinc-600">
                    {message.type === "sent_email" ? "to" : "from"}{" "}
                    {message.sender}
                  </span>
                )}
              </div>
            </div>
          )}

          {message.type === "ai_response" && message.streamId ? (
            <StreamingMessage
              message={message}
              isDriven={isDriven}
              stopStreaming={onStopStreaming}
            />
          ) : isEmailMessage ? (
            <div
              className="prose prose-sm"
              dangerouslySetInnerHTML={{
                __html: message.content || "",
              }}
            />
          ) : (
            <div className="prose prose-sm max-w-none">
              {message.content || ""}
            </div>
          )}

          {message.attachments && message.emailId && (
            <AttachmentList
              attachments={message.attachments}
              onDownload={(attachmentId, fileName) =>
                onDownloadAttachment(message.emailId!, attachmentId, fileName)
              }
            />
          )}
        </div>
      </div>
    </div>
  );
});
