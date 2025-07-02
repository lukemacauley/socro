import { ConversationView } from "~/components-test/ConversationView";
import type { Route } from "./+types/chat";
import type { Id } from "convex/_generated/dataModel";

export default function Page({ params }: Route.ComponentProps) {
  return <ConversationView conversationId={params.id as Id<"conversations">} />;
}
