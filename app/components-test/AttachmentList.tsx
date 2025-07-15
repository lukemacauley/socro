import { memo } from "react";
import { api } from "convex/_generated/api";
import AttachmentButton from "./AttachmentButton";

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
    <div className="flex items-center justify-start gap-4 py-2 overflow-auto scrollbar-hide">
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
