import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useQuery, useMutation, useAction } from "convex/react";
import { useState } from "react";

export function ConversationView({
  conversationId,
}: {
  conversationId: Id<"conversations">;
}) {
  const conversationData = useQuery(api.conversations.get, { conversationId });
  const updateStatus = useMutation(api.conversations.updateStatus);
  const addUserNote = useMutation(api.conversations.addUserNote);
  const generateAiResponse = useAction(api.ai.generateResponse);

  const [newNote, setNewNote] = useState("");
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);

  if (conversationData === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!conversationData) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>Conversation not found</p>
      </div>
    );
  }

  const { conversation, messages } = conversationData;

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
    const originalEmail = messages.find((m) => m.type === "email");
    if (!originalEmail) {
      // toast.error("No original email found");
      return;
    }

    setIsGeneratingResponse(true);
    try {
      await generateAiResponse({
        conversationId,
        emailContent: originalEmail.content,
        emailSubject: conversation.subject,
        senderName: conversation.fromName,
      });
      // toast.success("AI response generated");
    } catch (error) {
      // toast.error("Failed to generate AI response");
    } finally {
      setIsGeneratingResponse(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h1 className="text-xl font-semibold mb-1">
              {conversation.subject}
            </h1>
            <p className="text-sm text-gray-600">
              From: {conversation.fromName || conversation.fromEmail}
            </p>
          </div>

          {/* Status controls */}
          <div className="flex gap-2">
            <select
              value={conversation.status}
              onChange={(e) => handleStatusChange(e.target.value as any)}
              className="px-3 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>

            <button
              onClick={handleGenerateResponse}
              disabled={isGeneratingResponse}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingResponse ? "Generating..." : "Generate AI Response"}
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
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
            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
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
