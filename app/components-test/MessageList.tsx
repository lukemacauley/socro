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
import { RotateCw, CheckIcon, CopyIcon, Edit } from "lucide-react";
import { useAction } from "convex/react";
import { cn } from "~/lib/utils";
import { marked } from "marked";
import { toast } from "sonner";
import { useMessageStream } from "~/hooks/useMessageStream";
import type { Id } from "convex/_generated/dataModel";
import { useQuery } from "convex-helpers/react/cache";

export type Message = NonNullable<
  typeof api.threads.getThreadByClientId._returnType
>["messages"][number];

const initialSuggestions = [
  {
    title: "Help with Torts",
    description: "Get help understanding tort law concepts and cases",
    prompt: "Help me with torts",
  },
  {
    title: "Criminal Law Basics",
    description: "Learn about criminal law principles and defenses",
    prompt: "Explain the basics of criminal law",
  },
  {
    title: "Contract Review",
    description: "Understand contract terms and obligations",
    prompt: "Help me review a contract",
  },
  {
    title: "Legal Research",
    description: "Find relevant cases and statutes for your issue",
    prompt: "I need help with legal research",
  },
];

export const MessageList = memo(function MessageList({
  messages,
  threadId,
  onSendFirstMessage,
}: {
  messages: Message[] | undefined;
  threadId: Id<"threads"> | undefined;
  onSendFirstMessage?: (content: string) => void;
}) {
  const user = useQuery(api.users.current);

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div
          className={
            onSendFirstMessage
              ? "flex-1 flex items-center justify-center mb-16"
              : "hidden"
          }
        >
          <div className="max-w-2xl w-full px-6">
            <h2 className="text-2xl font-semibold text-center mb-8">
              What can I help you with, {user?.name}?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {initialSuggestions.map((suggestion, index) => (
                <Button
                  variant="outline"
                  key={index}
                  onClick={() => onSendFirstMessage?.(suggestion.prompt)}
                  className="block group h-auto p-4 whitespace-normal font-normal"
                >
                  <h3 className="font-medium mb-1">{suggestion.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {suggestion.description}
                  </p>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AIConversation className="bg-primary-foreground">
        <AIConversationContent>
          <div className="max-w-3xl mx-auto">
            {messages.map((m) => (
              <MessageItem message={m} threadId={threadId} key={m._id} />
            ))}
          </div>
        </AIConversationContent>
        <AIConversationScrollButton />
      </AIConversation>
    </div>
  );
});

function MessageItem({
  message,
  threadId,
}: {
  message: Message;
  threadId: Id<"threads"> | undefined;
}) {
  const messageId = message._id;

  const retryMessage = useAction(api.messages.retryMessage);

  const { streamedContent } = useMessageStream(
    messageId,
    threadId || message.threadId,
    message.isStreaming
  );

  const isAi = message.type === "ai";

  const displayContent =
    message.isStreaming && streamedContent ? streamedContent : message.content;

  const isEmpty = !displayContent || displayContent.trim() === "";

  const [isCopied, setIsCopied] = useState(false);

  const handleRetry = async () => {
    try {
      await retryMessage({ messageId });
    } catch (error) {
      console.error("Failed to retry message:", error);
    }
  };

  const copyToClipboard = () => {
    if (typeof window === "undefined" || !navigator.clipboard.write) {
      return;
    }

    const textToCopy = displayContent;

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
        toast.success("Message copied to clipboard");
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
  };

  return (
    <AIMessage from={isAi ? "assistant" : "user"}>
      {isEmpty ? (
        <Spinner variant="bars" />
      ) : isAi ? (
        <AIResponse>{displayContent}</AIResponse>
      ) : (
        <AIMessageContent>
          {displayContent}
          <AttachmentList attachments={message.attachments} />
        </AIMessageContent>
      )}
      <div
        className={cn(
          "opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1",
          isAi ? "mt-2 flex-row" : "flex-row-reverse"
        )}
      >
        {isAi ? (
          <Button
            size="icon"
            variant="ghost"
            tooltip="Retry message"
            onClick={handleRetry}
          >
            <RotateCw className="size-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            tooltip="Edit message"
            onClick={handleRetry}
          >
            <Edit className="size-4" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          tooltip="Copy message"
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
