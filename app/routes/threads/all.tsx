import { ConversationList } from "~/components-test/ConversationList";
import type { Route } from "./+types/all";

export default function Page(_: Route.ComponentProps) {
  return <ConversationList />;
}
