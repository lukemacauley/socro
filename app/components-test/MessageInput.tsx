import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useSidebar } from "~/components/ui/sidebar";
import { useStreamingResponse } from "~/hooks/useStreamingResponse";

export function MessageInput({
  conversationId,
}: {
  conversationId: Id<"conversations">;
}) {
  const { streamResponse } = useStreamingResponse();
  const { state } = useSidebar();
  const addUserNote = useMutation(api.conversations.addUserNote);

  const [newNote, setNewNote] = useState("");

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      const result = await addUserNote({ conversationId, content: newNote });
      setNewNote("");

      // Trigger streaming AI response
      await streamResponse(
        `${import.meta.env.VITE_CONVEX_SITE_URL}/stream-ai-response`,
        {
          messages: [
            {
              role: "user",
              content: newNote,
              data: result,
            },
          ],
        },
        result.aiResponseId
      );
    } catch (error) {
      toast.error("Failed to add note");
    }
  };

  return (
    <div
      className="fixed left-0 right-0 bottom-0"
      style={{
        left: state === "collapsed" ? "3rem" : "18rem",
      }}
    >
      <div className="p-4 max-w-3xl w-full mx-auto backdrop-blur-md bg-white/50">
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
