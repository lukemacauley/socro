import { memo } from "react";
import AttachmentButton from "./AttachmentButton";
import { Paperclip } from "lucide-react";
import type { Message } from "./MessageList";

type Attachment = Message["attachments"][number];

export const AttachmentList = memo(function AttachmentList({
  attachments,
}: {
  attachments: Attachment[];
}) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-start gap-2 overflow-auto scrollbar-hide mt-3">
      <Paperclip className="text-muted-foreground size-4" />
      {attachments?.filter(Boolean).map((att) => (
        <AttachmentButton
          key={att._id}
          name={att.name}
          storageId={att.storageId}
          type={att.contentType.split("/")[1]}
        />
      ))}
    </div>
  );
});
