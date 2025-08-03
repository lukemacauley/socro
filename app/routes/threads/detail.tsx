import { ConversationView } from "~/components-test/ConversationView";
import type { Route } from "./+types/detail";

export default function Page({ params }: Route.ComponentProps) {
  return <ConversationView browserId={params.id} />;
}
