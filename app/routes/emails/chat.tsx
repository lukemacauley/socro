import { ConversationView } from "~/components-test/ConversationView";
import type { Route } from "./+types/chat";
import type { Id } from "convex/_generated/dataModel";

export default function Page({ params }: Route.ComponentProps) {
  const id = params.id as Id<"conversations">;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <ConversationView conversationId={id} />
    </div>
  );
}
