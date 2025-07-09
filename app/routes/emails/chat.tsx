import { ConversationView } from "~/components-test/ConversationView.client";
import type { Route } from "./+types/chat";
import type { Id } from "convex/_generated/dataModel";

export default function Page({ params }: Route.ComponentProps) {
  const id = params.id as Id<"conversations">;

  return <ConversationView conversationId={id} />;
}
