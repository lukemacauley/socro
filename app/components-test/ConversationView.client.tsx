import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useState, useCallback } from "react";
import { ConversationHeader } from "./ConversationHeader";
import { MessageList } from "./MessageList.client";
import { MessageInput } from "./MessageInput.client";

export function ConversationView({
  conversationId,
}: {
  conversationId: Id<"conversations">;
}) {
  const data = useQuery(api.conversations.get, { conversationId });
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);

  const handleMessageSent = useCallback((streamId: string) => {
    setIsStreaming(true);
    setActiveStreamId(streamId);
  }, []);

  const handleStreamComplete = useCallback(() => {
    setIsStreaming(false);
    setActiveStreamId(null);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <ConversationHeader
        subject={data?.conversation.subject}
        participants={data?.conversation.participants}
      />
      
      <MessageList
        messages={data?.messages || []}
        activeStreamId={activeStreamId}
        isStreaming={isStreaming}
        onStreamComplete={handleStreamComplete}
      />
      
      <MessageInput
        conversationId={conversationId}
        onMessageSent={handleMessageSent}
        disabled={isStreaming}
      />
    </div>
  );
}
