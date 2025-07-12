import { memo, useState, useCallback, type FormEventHandler } from "react";
import { useSidebar } from "~/components/ui/sidebar";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  AIInput,
  AIInputButton,
  AIInputSubmit,
  AIInputTextarea,
  AIInputToolbar,
  AIInputTools,
} from "~/components/kibo-ui/ai/input";
import { Paperclip } from "lucide-react";

export const MessageInput = memo(function MessageInput({
  threadId,
}: {
  threadId: Id<"threads">;
}) {
  const sendMessage = useAction(api.messages.sendMessage);

  const { state } = useSidebar();

  const [input, setInput] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;

      const message = input;
      setInput("");

      await sendMessage({
        threadId,
        content: message,
      });
    },
    [input, threadId, sendMessage]
  );

  return (
    <div
      className="sticky left-0 right-0 bottom-4"
      style={{
        left: state === "collapsed" ? "3rem" : "18rem",
      }}
    >
      <div className="max-w-[808px] w-full mx-auto">
        <AIInput onSubmit={handleSubmit}>
          <AIInputTextarea
            onChange={(e) => setInput(e.target.value)}
            value={input}
          />
          <AIInputToolbar>
            <AIInputTools>
              <AIInputButton variant="outline">
                <Paperclip size={16} />
              </AIInputButton>
            </AIInputTools>
            <AIInputSubmit disabled={!input} size="icon" />
          </AIInputToolbar>
        </AIInput>
      </div>
    </div>
  );
});
