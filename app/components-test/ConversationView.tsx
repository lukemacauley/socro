import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useQuery, useMutation, useAction } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export function ConversationView({
  conversationId,
}: {
  conversationId: Id<"conversations">;
}) {
  const data = useQuery(api.conversations.get, { conversationId });
  const updateStatus = useMutation(api.conversations.updateStatus);
  const addUserNote = useMutation(api.conversations.addUserNote);
  const generateAiResponse = useAction(api.ai.generateResponse);
  const downloadAttachment = useAction(api.webhooks.downloadAttachment);

  const [newNote, setNewNote] = useState("");

  const handleStatusChange = async (
    status: "new" | "in_progress" | "resolved"
  ) => {
    try {
      await updateStatus({ conversationId, status });
      // toast.success("Status updated");
    } catch (error) {
      // toast.error("Failed to update status");
    }
  };

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
        senderName: data?.conversation.fromName,
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
            <p className="text-sm text-gray-600">
              From:{" "}
              {data?.conversation.fromName || data?.conversation.fromEmail}
            </p>
          </div>

          {/* Status controls */}
          <div className="flex gap-2">
            <select
              value={data?.conversation.status}
              onChange={(e) =>
                handleStatusChange(
                  e.target.value as "new" | "in_progress" | "resolved"
                )
              }
              className="px-3 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>

            <button
              onClick={handleGenerateResponse}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate AI Response
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {data?.messages.map((message) => (
          <div
            key={message._id}
            className={`p-4 rounded-lg ${
              message.type === "email"
                ? "bg-blue-50 border border-blue-200"
                : message.type === "ai_response"
                ? "bg-green-50 border border-green-200"
                : "bg-gray-50 border border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {message.type === "email" && "📧 Email"}
                  {message.type === "ai_response" && "🤖 AI Response"}
                  {message.type === "user_note" && "📝 Your Note"}
                </span>
                {message.sender && message.type !== "user_note" && (
                  <span className="text-xs text-gray-600">
                    from {message.sender}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {new Date(message.timestamp).toLocaleString()}
              </span>
            </div>
            {message.type === "ai_response" ? (
              <div className="prose prose-sm">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            ) : (
              <div className="prose prose-sm whitespace-pre-wrap">
                {message.content}
              </div>
            )}

            {/* Display attachments if any */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Attachments ({message.attachments.length})
                </p>
                <div className="space-y-2">
                  {message.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-2">
                        <svg
                          className="w-5 h-5 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                          />
                        </svg>
                        <div>
                          <p className="text-sm font-medium">
                            {attachment.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {attachment.contentType} •{" "}
                            {(attachment.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          handleDownloadAttachment(
                            message.emailId!,
                            attachment.id,
                            attachment.name
                          )
                        }
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
