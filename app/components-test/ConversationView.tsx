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

  if (!data) {
    return null;
  }

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col">
      <ConversationHeader
        subject={data?.conversation.subject}
        participants={data?.conversation.participants}
      />
      <MessageList conversationId={conversationId} />
      <MessageInput conversationId={conversationId} />
    </div>
  );
}
