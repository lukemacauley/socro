import { ConversationList } from "./ConversationList";
import { useSearchParams } from "react-router";

export default function Threads() {
  const [params] = useSearchParams();
  const status = params.get("status");

  if (status === "archived") {
    return (
      <div className="p-4">
        <ConversationList threadStatus="archived" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <ConversationList threadStatus="active" />
    </div>
  );
}
