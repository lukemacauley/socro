import { useNavigate } from "react-router";
import { v7 as createId } from "uuid";
import { ConversationView } from "~/components-test/ConversationView";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";

export default function Page() {
  const navigate = useNavigate();
  const createThreadAndSendMessage = useAction(
    api.messages.createThreadAndSendMessage
  );

  const handleSendFirstMessage = async (content: string, uploadId?: string) => {
    const threadId = createId();
    navigate(`/threads/${threadId}`);

    await createThreadAndSendMessage({
      content,
      uploadId,
      threadId,
    });
  };

  return <ConversationView onSendFirstMessage={handleSendFirstMessage} />;
}
