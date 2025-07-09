import { useEffect, useRef, useState, useCallback, memo } from "react";
import { MessageItem } from "./MessageItem.client";
import { StreamingMessage } from "./StreamingMessage.client";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";

interface MessageListProps {
  messages: any[];
  activeStreamId: string | null;
  isStreaming: boolean;
  onStreamComplete: () => void;
}

export const MessageList = memo(function MessageList({
  messages,
  activeStreamId,
  isStreaming,
  onStreamComplete,
}: MessageListProps) {
  const [drivenIds, setDrivenIds] = useState<Set<string>>(() => {
    // Initialize with activeStreamId if present
    return activeStreamId ? new Set([activeStreamId]) : new Set();
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const downloadAttachment = useAction(api.webhooks.downloadAttachment);

  // Update drivenIds when activeStreamId changes
  useEffect(() => {
    if (activeStreamId) {
      setDrivenIds((prev) => new Set([...prev, activeStreamId]));
    }
  }, [activeStreamId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages.length]);

  const handleStopStreaming = useCallback(
    (streamId: string) => {
      setDrivenIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(streamId);
        return newSet;
      });

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
    <>
      <div className="flex-1 max-w-3xl w-full mx-auto py-12 overflow-y-auto space-y-12">
        {messages.map((message) => {
          const isLast = messages[messages.length - 1]._id === message._id;
          return (
            <MessageItem
              key={message._id}
              message={message}
              isDriven={
                message.streamId ? drivenIds.has(message.streamId) : false
              }
              isLast={isLast}
              isStreaming={isStreaming}
              activeStreamId={activeStreamId}
              onStopStreaming={() =>
                message.streamId && handleStopStreaming(message.streamId)
              }
              onDownloadAttachment={handleDownloadAttachment}
            />
          );
        })}

        {/* Virtual AI Response when streaming */}
        {activeStreamId && isStreaming && (
          <div className="flex justify-start min-h-[calc(100vh-20rem)]">
            <div className="w-full">
              <div className="w-full p-0 border-zinc-200">
                <StreamingMessage
                  message={{
                    _id: `virtual-${activeStreamId}`,
                    content: "",
                    streamId: activeStreamId,
                  }}
                  isDriven={drivenIds.has(activeStreamId)}
                  stopStreaming={() => handleStopStreaming(activeStreamId)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <div ref={scrollRef} />
    </>
  );
});
