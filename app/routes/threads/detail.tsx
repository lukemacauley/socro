import { ConversationView } from "~/components-test/ConversationView";
import type { Route } from "./+types/detail";

export const meta: Route.MetaFunction = ({ params }) => {
  return [
    { title: `Conversation ${params.id} - Socro` },
    { name: "description", content: "View and continue your AI conversation on Socro. Access your chat history and get intelligent responses." },
    { property: "og:title", content: `Conversation ${params.id} - Socro` },
    { property: "og:description", content: "View and continue your AI conversation on Socro. Access your chat history and get intelligent responses." },
  ];
};

export default function Page({ params }: Route.ComponentProps) {
  return <ConversationView browserId={params.id} />;
}
