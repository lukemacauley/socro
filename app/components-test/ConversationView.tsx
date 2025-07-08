import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useQuery, useMutation, useAction } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "~/lib/utils";
import { Download, Paperclip } from "lucide-react";
import { Button } from "~/components/ui/button";

export function ConversationView({
  conversationId,
}: {
  conversationId: Id<"conversations">;
}) {
  const data = useQuery(api.conversations.get, { conversationId });
  const addUserNote = useMutation(api.conversations.addUserNote);
  const generateAiResponse = useAction(api.ai.generateResponse);
  const downloadAttachment = useAction(api.webhooks.downloadAttachment);

  const [newNote, setNewNote] = useState("");

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      await addUserNote({ conversationId, content: newNote });
      setNewNote("");
      // toast.success("Note added");
    } catch (error) {
      // toast.error("Failed to add note");
    }
  };

  const handleGenerateResponse = async () => {
    const originalEmail = data?.messages.find((m) => m.type === "email");
    if (!originalEmail) {
      toast.error("No original email found");
      return;
    }

    try {
      await generateAiResponse({
        conversationId,
        emailContent: originalEmail.content,
        emailSubject: data?.conversation.subject ?? "",
        senderName:
          data?.conversation.participants.map((p) => p.name).join(", ") || "",
      });
      toast.success("AI response generated");
    } catch (error) {
      toast.error("Failed to generate AI response");
    }
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
      <div className="flex-1 max-w-3xl w-full mx-auto pt-10 pb-16 overflow-y-auto space-y-12">
        {data?.messages.map((message) => (
          <div
            key={message._id}
            className={cn(
              "flex last:min-h-[calc(100vh-20rem)]",
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
                {message.type === "ai_response" ? (
                  <div className="prose max-w-none">
                    <ReactMarkdown>{message.content || ""}</ReactMarkdown>
                  </div>
                ) : message.type === "email" ||
                  message.type === "sent_email" ? (
                  <div
                    className="prose"
                    dangerouslySetInnerHTML={{ __html: message.content }}
                  />
                ) : (
                  <div className="prose">{message.content}</div>
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
        ))}
      </div>

      {/* Add note form */}
      <div className="p-4 border-t bg-white">
        <form onSubmit={handleAddNote} className="flex gap-2">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note to this conversation..."
            className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!newNote.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Note
          </button>
        </form>
      </div>
    </div>
  );
}
