import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useQuery, useMutation, useAction } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "~/lib/utils";
import { Download, Paperclip } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  useThreadMessages,
  toUIMessages,
  useSmoothText,
  type UIMessage,
  optimisticallySendMessage,
} from "@convex-dev/agent/react";

export function ConversationView({
  // conversationId,
  threadId,
}: {
  // conversationId: Id<"conversations">;
  threadId: string;
}) {
  // const data = useQuery(api.conversations.get, { conversationId });
  const addUserNote = useMutation(api.conversations.addUserNote);
  const downloadAttachment = useAction(api.webhooks.downloadAttachment);

  const messages = useThreadMessages(
    api.agent.listThreadMessages,
    { threadId },
    { initialNumItems: 10, stream: true }
  );

  const [prompt, setPrompt] = useState("Tell me a story");

  function onSendClicked() {
    if (prompt.trim() === "") return;
    void sendMessage({ threadId, prompt }).catch(() => setPrompt(prompt));
    setPrompt("");
  }

  const sendMessage = useMutation(
    api.agent.streamAsynchronously
  ).withOptimisticUpdate(
    optimisticallySendMessage(api.agent.listThreadMessages)
  );

  // const handleAddNote = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (!newNote.trim()) return;

  //   try {
  //     await addUserNote({ conversationId, content: newNote });
  //     setNewNote("");
  //     // toast.success("Note added");
  //   } catch (error) {
  //     // toast.error("Failed to add note");
  //   }
  // };

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
          {/* <div className="flex-1">
            <h1 className="text-xl font-semibold mb-1">
              {data?.conversation.subject}
            </h1>
            <p className="text-sm text-zinc-600">
              From:{" "}
              {data?.conversation.participants
                .map((p) => p.name || p.email)
                .join(", ")}
            </p>
          </div> */}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 max-w-3xl w-full mx-auto pt-10 pb-16 overflow-y-auto space-y-12">
        {messages.results?.length > 0 && (
          <div className="flex flex-col gap-4 overflow-y-auto mb-4">
            {toUIMessages(messages.results ?? []).map((m) => (
              <Message key={m.key} message={m} />
            ))}
          </div>
        )}
      </div>

      {/* Add note form */}
      <div className="p-4 border-t bg-white">
        <form
          className="flex gap-2 items-center"
          onSubmit={(e) => {
            e.preventDefault();
            onSendClicked();
          }}
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
            placeholder={
              messages.results?.length > 0
                ? "Continue the story..."
                : "Tell me a story..."
            }
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-semibold disabled:opacity-50"
            disabled={!prompt.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function Message({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  console.log({ role: message.role, message });

  const [visibleText, { isStreaming, cursor }] = useSmoothText(
    message.content,
    {
      // This tells the hook that it's ok to start streaming immediately.
      // If this was always passed as true, messages that are already done would
      // also stream in.
      // IF this was always passed as false (default), then the streaming message
      // wouldn't start streaming until the second chunk was received.
      startStreaming: message.status === "streaming",
    }
  );

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("rounded-lg px-4 py-2", isUser ? "bg-orange-50" : "")}>
        {isUser ? (
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: message.content }}
          />
        ) : (
          <div className="prose">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
