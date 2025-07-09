import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { ArrowUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
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
          streamId: result.streamId,
          conversationId: result.conversationId,
          emailContent: result.emailContent,
          emailSubject: result.emailSubject,
          senderName: result.senderName,
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
      <div className="p-4 max-w-4xl w-full mx-auto backdrop-blur-md bg-white/50 border-t-4 border-x-4 border-orange-100 rounded-t-xl">
        <form onSubmit={handleAddNote} className="flex gap-2">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note to this conversation..."
            className="flex-1 px-3 py-2 focus:outline-none focus:ring-0"
          />
          <Button type="submit" disabled={!newNote.trim()} size="icon">
            <ArrowUp className="size-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
