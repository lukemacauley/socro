import { memo } from "react";

interface ConversationHeaderProps {
  subject?: string;
  participants?: Array<{ name?: string; email: string }>;
}

export const ConversationHeader = memo(function ConversationHeader({
  subject,
  participants,
}: ConversationHeaderProps) {
  return (
    <div className="sticky top-12 p-4 border-b bg-white">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h1 className="text-xl font-semibold mb-1">{subject}</h1>
          <p className="text-sm text-zinc-600">
            From: {participants?.map((p) => p.name || p.email).join(", ")}
          </p>
        </div>
      </div>
    </div>
  );
});
