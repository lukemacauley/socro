import { useQuery } from "convex-helpers/react/cache";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { type LucideProps } from "lucide-react";
import { useCallback } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export default function AttachmentButton({
  name,
  storageId,
  type,
  onClick,
  icon: Icon,
}: {
  name: string;
  storageId?: Id<"_storage">;
  type: string;
  onClick?: () => void;
  icon?: React.ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
  >;
}) {
  const storageUrl = useQuery(
    api.attachments.getAttachmentUrl,
    storageId ? { storageId } : "skip"
  );

  const handleOnClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else if (storageUrl) {
      window.open(`${storageUrl}`, "_blank");
    }
  }, [storageUrl, onClick]);

  return (
    <Button
      variant="outline"
      size="sm"
      className="justify-start px-1.5 max-w-48"
      tooltip={name}
      onClick={handleOnClick}
    >
      <Badge className="uppercase">{type}</Badge>
      <div className="truncate">{name}</div>
      {Icon ? <Icon className="size-4" /> : null}
    </Button>
  );
}
