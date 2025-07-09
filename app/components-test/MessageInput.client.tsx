import { memo, useState, useCallback } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useSidebar } from "~/components/ui/sidebar";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

interface MessageInputProps {
  conversationId: Id<"conversations">;
  onMessageSent: (streamId: string) => void;
  disabled?: boolean;
}

export const MessageInput = memo(function MessageInput({
  conversationId,
  onMessageSent,
  disabled,
}: MessageInputProps) {
  const [input, setInput] = useState("");
  const { state } = useSidebar();
  const sendMessage = useMutation(api.conversations.sendMessage);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;

      const message = input;
      setInput("");

      const { streamId } = await sendMessage({
        conversationId,
        prompt: message,
      });

      onMessageSent(streamId);
    },
    [input, conversationId, sendMessage, onMessageSent]
  );

  return (
    <div
      className="sticky left-0 right-0 bottom-0"
      style={{
        left: state === "collapsed" ? "3rem" : "18rem",
      }}
    >
      <div className="p-4 max-w-4xl w-full mx-auto backdrop-blur-md bg-white/50 border-t-4 border-x-4 border-blue-100 rounded-t-xl">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a note to this conversation..."
            className="flex-1 px-3 py-2 focus:outline-none focus:ring-0"
          />
          <Button
            type="submit"
            disabled={!input.trim() || disabled}
            size="icon"
          >
            <ArrowUp className="size-5" />
          </Button>
        </form>
      </div>
    </div>
  );
});
