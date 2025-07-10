import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useQuery } from "convex-helpers/react/cache";
import { useState } from "react";
import { ConversationHeader } from "./ConversationHeader";
import { MessageList } from "./MessageList.client";
import { MessageInput } from "./MessageInput.client";
import type { StreamId } from "@convex-dev/persistent-text-streaming";

export function ConversationView({
  conversationId,
}: {
  conversationId: Id<"conversations">;
}) {
  const data = useQuery(api.conversations.get, { conversationId });
  const [activeStreamId, setActiveStreamId] = useState<StreamId | null>(null);

  if (!data) {
    return null;
  }

  return (
    <>
      <ConversationHeader
        subject={data?.conversation.subject}
        participants={data?.conversation.participants}
      />

      <MessageList
        messages={data?.messages || []}
        activeStreamId={activeStreamId}
        onStreamComplete={() => setActiveStreamId(null)}
      />

      <MessageInput
        conversationId={conversationId}
        onMessageSent={setActiveStreamId}
        disabled={!!activeStreamId}
      />
    </>
  );
}
