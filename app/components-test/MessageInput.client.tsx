import { memo, useState, useCallback, type FormEventHandler } from "react";
import { useSidebar } from "~/components/ui/sidebar";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  AIInput,
  AIInputButton,
  AIInputModelSelect,
  AIInputModelSelectContent,
  AIInputModelSelectItem,
  AIInputModelSelectTrigger,
  AIInputModelSelectValue,
  AIInputSubmit,
  AIInputTextarea,
  AIInputToolbar,
  AIInputTools,
} from "~/components/kibo-ui/ai/input";
import { GlobeIcon, MicIcon, PlusIcon } from "lucide-react";
import type { StreamId } from "@convex-dev/persistent-text-streaming";

const models = [
  { id: "gpt-4", name: "GPT-4" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  { id: "claude-2", name: "Claude 2" },
  { id: "claude-instant", name: "Claude Instant" },
  { id: "palm-2", name: "PaLM 2" },
  { id: "llama-2-70b", name: "Llama 2 70B" },
  { id: "llama-2-13b", name: "Llama 2 13B" },
  { id: "cohere-command", name: "Command" },
  { id: "mistral-7b", name: "Mistral 7B" },
];

export const MessageInput = memo(function MessageInput({
  conversationId,
  onMessageSent,
  disabled,
}: {
  conversationId: Id<"conversations">;
  onMessageSent: (streamId: StreamId) => void;
  disabled?: boolean;
}) {
  const sendMessage = useMutation(api.conversations.sendMessage);
  const { state } = useSidebar();

  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(models[0].id);

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
              <AIInputButton>
                <PlusIcon size={16} />
              </AIInputButton>
              <AIInputButton>
                <MicIcon size={16} />
              </AIInputButton>
              <AIInputButton>
                <GlobeIcon size={16} />
                <span>Search</span>
              </AIInputButton>
              <AIInputModelSelect onValueChange={setModel} value={model}>
                <AIInputModelSelectTrigger>
                  <AIInputModelSelectValue />
                </AIInputModelSelectTrigger>
                <AIInputModelSelectContent>
                  {models.map((model) => (
                    <AIInputModelSelectItem key={model.id} value={model.id}>
                      {model.name}
                    </AIInputModelSelectItem>
                  ))}
                </AIInputModelSelectContent>
              </AIInputModelSelect>
            </AIInputTools>
            <AIInputSubmit disabled={!input || disabled} />
          </AIInputToolbar>
        </AIInput>
      </div>
    </div>
  );
});
