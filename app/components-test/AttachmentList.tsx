import { memo, useCallback } from "react";
import { Paperclip, Download } from "lucide-react";
import { Button } from "~/components/ui/button";
import { api } from "convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache";
import { toast } from "sonner";

type Attachment =
  (typeof api.messages.getMessages._returnType)[number]["attachments"][number];

export const AttachmentList = memo(function AttachmentList({
  attachments,
  onDownload,
}: {
  attachments: Attachment[];
  onDownload: (attachmentId: string, fileName: string) => void;
}) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="w-full mt-3 border-t pt-3">
      <p className="text-sm font-medium mb-2">
        Attachments ({attachments.length})
      </p>
      <div className="space-y-2">
        {attachments.map((att) => (
          <AttachmentItem att={att} key={att._id} />
        ))}
      </div>
    </div>
  );
});

function AttachmentItem({ att }: { att: Attachment }) {
  const storageUrl = useQuery(api.attachments.getAttachmentUrl, {
    storageId: att.storageId,
  });

  const handleDownloadAttachment = useCallback(async () => {
    try {
      if (!storageUrl) {
        toast.error("Download URL not available yet");
        return;
      }

      toast.info("Downloading attachment...");

      // For better cross-browser support
      const link = document.createElement("a");
      link.href = storageUrl;
      link.download = att.name || "Download";
      link.target = "_blank"; // Fallback for browsers that don't support download attribute
      link.rel = "noopener noreferrer";

      // Some browsers need the link to be in the DOM during the click
      document.body.appendChild(link);

      // Use setTimeout to ensure the link is in the DOM
      setTimeout(() => {
        link.click();
        document.body.removeChild(link);

        // Clean up the object URL if it's a blob URL
        if (storageUrl.startsWith("blob:")) {
          URL.revokeObjectURL(storageUrl);
        }
      }, 0);

      toast.success("Attachment downloaded");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download attachment");
    }
  }, [storageUrl, att.name]);

  return (
    <div className="flex items-center justify-between p-2 rounded-lg">
      <div className="flex items-center space-x-2">
        <Paperclip className="size-5" />
        <div>
          <p className="text-sm font-medium">{att.name}</p>
          <p className="text-xs text-muted-foreground">
            {att.contentType}
            {att.size ? `• ${(att.size / 1024).toFixed(1)} KB` : null}
          </p>
        </div>
      </div>
      <Button size="icon" onClick={handleDownloadAttachment}>
        <Download />
      </Button>
    </div>
  );
}
