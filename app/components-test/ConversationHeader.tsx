import { memo } from "react";

export const ConversationHeader = memo(function ConversationHeader({
  subject,
  participants,
}: {
  subject?: string;
  participants?: Array<{ name?: string; email: string }>;
}) {
  return (
    <div className="sticky top-12 z-1 p-4 border-b bg-white">
      <div className="flex items-center gap-8">
        <div className="flex-none font-bold">{subject}</div>
        <div className="flex flex-none items-center gap-4 text-zinc-600">
          {participants?.map((p) => p.name || p.email).join(", ")}
        </div>
      </div>
    </div>
  );
});
