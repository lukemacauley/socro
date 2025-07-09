import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useQuery, useMutation, useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { ArrowUp, Download, Paperclip } from "lucide-react";
import { Button } from "~/components/ui/button";
import { StreamingMessage } from "./StreamingMessage.client";
import ReactMarkdown from "react-markdown";
import { useSidebar } from "~/components/ui/sidebar";

export function ConversationView({
  conversationId,
}: {
  conversationId: Id<"conversations">;
}) {
  const data = useQuery(api.conversations.get, { conversationId });

  const sendMessage = useMutation(api.conversations.sendMessage);
  const downloadAttachment = useAction(api.webhooks.downloadAttachment);

  const [input, setInput] = useState("");
  const [drivenIds, setDrivenIds] = useState<Set<string>>(new Set());
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "instant" });
  }, [data?.messages.length]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setInput("");
    setIsStreaming(true);

    const { streamId } = await sendMessage({
      conversationId,
      prompt: input,
    });

    // Set active stream ID for virtual AI response
    setActiveStreamId(streamId);

    // Track this streamId as "driven" so the AI response will stream
    setDrivenIds((prev) => {
      const newSet = new Set([...prev, streamId]);
      return newSet;
    });
  };

  const handleDownloadAttachment = async (
    emailId: string,
    attachmentId: string,
    fileName: string
  ) => {
    try {
      toast.info("Downloading attachment...");

      const result = await downloadAttachment({
        emailId,
        attachmentId,
      });

      if (result) {
        // Convert base64 to blob
        const byteCharacters = atob(result.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.contentType });

        // Create download link
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
  };

  const { state } = useSidebar();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h1 className="text-xl font-semibold mb-1">
              {data?.conversation.subject}
            </h1>
            <p className="text-sm text-zinc-600">
              From:{" "}
              {data?.conversation.participants
                .map((p) => p.name || p.email)
                .join(", ")}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 max-w-3xl w-full mx-auto pt-10 pb-24 overflow-y-auto space-y-12">
        {data?.messages.map((message) => {
          const isLast =
            data.messages[data.messages.length - 1]._id === message._id;
          return (
            <div
              key={message._id}
              className={cn(
                "flex",
                isLast && !activeStreamId && !isStreaming
                  ? "min-h-[calc(100vh-20rem)]"
                  : "",
                message.type === "sent_email" || message.type === "user_note"
                  ? "justify-end"
                  : "justify-start"
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
                      ? "w-full bg-orange-50 border border-zinc-200"
                      : message.type === "sent_email"
                      ? "w-full bg-orange-50 border border-zinc-200"
                      : message.type === "user_note"
                      ? "w-full bg-orange-50 border border-zinc-200"
                      : message.type === "ai_response"
                      ? "w-full p-0 border-zinc-200"
                      : "w-full"
                  )}
                >
                  <div
                    className={
                      message.type === "email" || message.type === "sent_email"
                        ? "flex items-center justify-between mb-2"
                        : "hidden"
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {message.type === "email" && "Received"}
                        {message.type === "sent_email" && "Sent"}
                      </span>
                      {message.sender && (
                        <span className="text-xs text-zinc-600">
                          {message.type === "sent_email" ? "to" : "from"}{" "}
                          {message.sender}
                        </span>
                      )}
                    </div>
                  </div>
                  {message.type === "ai_response" && message.streamId ? (
                    <StreamingMessage
                      message={message}
                      isDriven={drivenIds.has(message.streamId)}
                      stopStreaming={() => {
                        console.log(
                          "[CONVERSATION_VIEW] stopStreaming called for",
                          message.streamId
                        );
                        setIsStreaming(false);
                        if (message.streamId) {
                          setDrivenIds((prev) => {
                            const newSet = new Set(prev);
                            if (message.streamId) {
                              newSet.delete(message.streamId);
                            }
                            console.log(
                              "[CONVERSATION_VIEW] Removed streamId from drivenIds",
                              {
                                removed: message.streamId,
                                remaining: Array.from(newSet),
                              }
                            );
                            return newSet;
                          });
                        }
                      }}
                    />
                  ) : message.type === "email" ||
                    message.type === "sent_email" ? (
                    <div
                      className="prose"
                      dangerouslySetInnerHTML={{
                        __html: message.content || "",
                      }}
                    />
                  ) : (
                    <div className="prose max-w-none">
                      {message.content || ""}
                    </div>
                  )}

                  {/* Display attachments if any */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-sm font-medium text-zinc-700 mb-2">
                        Attachments ({message.attachments.length})
                      </p>
                      <div className="space-y-2">
                        {message.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center justify-between p-2 rounded-lg"
                          >
                            <div className="flex items-center space-x-2">
                              <Paperclip className="size-5" />
                              <div>
                                <p className="text-sm font-medium">
                                  {attachment.name}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  {attachment.contentType} •{" "}
                                  {(attachment.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                            <Button
                              size="icon"
                              onClick={() =>
                                handleDownloadAttachment(
                                  message.emailId!,
                                  attachment.id,
                                  attachment.name
                                )
                              }
                            >
                              <Download />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
                  stopStreaming={() => {
                    setIsStreaming(false);
                    setActiveStreamId(null);
                    setDrivenIds((prev) => {
                      const newSet = new Set(prev);
                      newSet.delete(activeStreamId);
                      return newSet;
                    });
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div ref={scrollRef} />

      {/* Add note form */}
      <div
        className="fixed left-0 right-0 bottom-0"
        style={{
          left: state === "collapsed" ? "3rem" : "18rem",
        }}
      >
        <div className="p-4 max-w-4xl w-full mx-auto backdrop-blur-md bg-white/50 border-t-4 border-x-4 border-orange-100 rounded-t-xl">
          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Add a note to this conversation..."
              className="flex-1 px-3 py-2 focus:outline-none focus:ring-0"
            />
            <Button type="submit" disabled={!input.trim()} size="icon">
              <ArrowUp className="size-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
