import { memo } from "react";
import { Paperclip, Download } from "lucide-react";
import { Button } from "~/components/ui/button";

interface Attachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
}

interface AttachmentListProps {
  attachments: Attachment[];
  onDownload: (attachmentId: string, fileName: string) => void;
}

export const AttachmentList = memo(function AttachmentList({
  attachments,
  onDownload,
}: AttachmentListProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mt-3 border-t pt-3">
      <p className="text-sm font-medium text-zinc-700 mb-2">
        Attachments ({attachments.length})
      </p>
      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between p-2 rounded-lg"
          >
            <div className="flex items-center space-x-2">
              <Paperclip className="size-5" />
              <div>
                <p className="text-sm font-medium">{attachment.name}</p>
                <p className="text-xs text-zinc-500">
                  {attachment.contentType} • {(attachment.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <Button
              size="icon"
              onClick={() => onDownload(attachment.id, attachment.name)}
            >
              <Download />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
});