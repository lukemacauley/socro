import { memo } from "react";
import { api } from "convex/_generated/api";
import AttachmentButton from "./AttachmentButton";
import { Paperclip } from "lucide-react";

type Attachment =
  (typeof api.messages.getMessages._returnType)[number]["attachments"][number];

export const AttachmentList = memo(function AttachmentList({
  attachments,
}: {
  attachments: Attachment[];
}) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-start gap-2 py-2 overflow-auto scrollbar-hide mt-4">
      <Paperclip className="text-muted-foreground size-4" />
      {attachments?.map((att) => (
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
