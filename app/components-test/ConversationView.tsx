import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { MessageItem } from "./MessageItem";
import { MessageInput } from "./MessageInput";
import { ConversationHeader } from "./ConversationHeader";

export function ConversationView({
  conversationId,
}: {
  conversationId: Id<"conversations">;
}) {
  const data = useQuery(api.conversations.get, { conversationId });

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "instant" });
  }, [data?.messages.length]);

  return (
    <div className="h-full flex flex-col relative">
      <ConversationHeader
        subject={data?.conversation.subject}
        participants={data?.conversation.participants}
      />

      <div className="flex-1 max-w-3xl w-full mx-auto pt-10 pb-16 overflow-y-auto space-y-12">
        {data?.messages.map((message, index) => (
          <MessageItem
            key={message._id}
            message={message}
            isLast={index === data.messages.length - 1}
          />
        ))}
      </div>
      <div ref={scrollRef} />

      <MessageInput conversationId={conversationId} />
    </div>
  );
}
