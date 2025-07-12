import type { api } from "convex/_generated/api";
import { memo } from "react";

type Thread = typeof api.threads.getThread._returnType;
type Participants = NonNullable<Thread>["thread"]["toParticipants"];

export const ConversationHeader = memo(function ConversationHeader({
  subject,
  participants,
}: {
  subject?: string;
  participants: Participants;
}) {
  return (
    <div className="sticky top-12 z-1 p-4 border-b border-sidebar-border bg-transparent backdrop-blur-md">
      <div className="flex items-center gap-8">
        <div className="flex-none font-bold text-foreground">{subject}</div>
        <div className="flex flex-none items-center gap-4 text-muted-foreground">
          {participants?.map((p) => p.name || p.email).join(", ")}
        </div>
      </div>
    </div>
  );
});
