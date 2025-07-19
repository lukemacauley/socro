import { memo, useState } from "react";
import { api } from "convex/_generated/api";
import {
  AIConversation,
  AIConversationContent,
  AIConversationScrollButton,
} from "~/components/kibo-ui/ai/conversation";
import { AIMessage, AIMessageContent } from "~/components/kibo-ui/ai/message";
import { AIResponse } from "~/components/kibo-ui/ai/response";
import { AttachmentList } from "./AttachmentList";
import { Spinner } from "~/components/kibo-ui/spinner";
import { Button } from "~/components/ui/button";
import { RotateCw, CheckIcon, CopyIcon } from "lucide-react";
import { useAction } from "convex/react";
import { cn } from "~/lib/utils";
import { marked } from "marked";
import { toast } from "sonner";

export type Message = NonNullable<
  typeof api.threads.getThreadByClientId._returnType
>["messages"][number];

export const MessageList = memo(function MessageList({
  messages,
}: {
  messages: Message[] | undefined;
}) {
  if (!messages || messages.length === 0) {
    return <div className="flex-1 flex flex-col min-h-0 pt-12" />;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 pt-12">
      <AIConversation className="bg-primary-foreground">
        <AIConversationContent>
          <div className="max-w-3xl mx-auto">
            {messages.map((m) => (
              <MessageItem message={m} key={m._id} />
            ))}
          </div>
        </AIConversationContent>
        <AIConversationScrollButton />
      </AIConversation>
    </div>
  );
});

function MessageItem({ message }: { message: Message }) {
  const retryMessage = useAction(api.messages.retryMessage);

  const isAi = message.messageType === "ai_response";
  const isEmpty = !message.content || message.content.trim() === "";

  const [isCopied, setIsCopied] = useState(false);

  const handleRetry = async () => {
    try {
      await retryMessage({ messageId: message._id });
    } catch (error) {
      console.error("Failed to retry message:", error);
    }
  };

  const extractEmailCodeBlocks = (content: string): string => {
    const emailCodeBlockRegex = /```email\n([\s\S]*?)\n```/g;
    const matches = [...content.matchAll(emailCodeBlockRegex)];
    if (!matches.length) return "";

    return matches.map((match) => match[1]).join("\n\n");
  };

  const copyToClipboard = () => {
    if (typeof window === "undefined" || !navigator.clipboard.write) {
      return;
    }

    let textToCopy = message.content;

    if (isAi && message.content) {
      const emailBlocks = extractEmailCodeBlocks(message.content);
      textToCopy = emailBlocks || message.content;
    }

    if (!textToCopy) {
      console.error("No content to copy");
      return;
    }

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = marked(textToCopy, { async: false });

    const htmlBlob = new Blob([tempDiv.innerHTML], { type: "text/html" });
    const textBlob = new Blob([tempDiv.innerText], { type: "text/plain" });

    navigator.clipboard
      .write([
        new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        }),
      ])
      .then(() => {
        toast.success(
          isAi ? "Email copied to clipboard " : "Message copied to clipboard"
        );
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
  };

  return (
    <AIMessage from={isAi ? "assistant" : "user"}>
      {isEmpty ? (
        <Spinner variant="bars" />
      ) : isAi ? (
        <AIResponse>{message.content}</AIResponse>
      ) : (
        <AIMessageContent>
          {message.content}
          <AttachmentList attachments={message.attachments} />
        </AIMessageContent>
      )}
      <div
        className={cn(
          "opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1",
          isAi ? "mt-2" : ""
        )}
      >
        <Button
          size="icon"
          variant="ghost"
          tooltip="Retry message"
          onClick={handleRetry}
        >
          <RotateCw className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          tooltip={isAi ? "Copy email" : "Copy message"}
          onClick={copyToClipboard}
        >
          {isCopied ? (
            <CheckIcon className="size-4" />
          ) : (
            <CopyIcon className="size-4" />
          )}
        </Button>
      </div>
    </AIMessage>
  );
}
