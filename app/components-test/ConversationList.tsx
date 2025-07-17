import { useQuery } from "convex-helpers/react/cache";
import { api } from "convex/_generated/api";
import { Link, useSearchParams } from "react-router";
import { Archive, ArchiveRestore, Pin, PinOff } from "lucide-react";
import { useMutation } from "convex/react";
import { Button } from "~/components/ui/button";

type ThreadStatus = "new" | "pinned" | "archived";

export function ConversationList() {
  const [params] = useSearchParams();
  const threadStatus = params.get("status") as ThreadStatus | null;

  const threads = useQuery(api.threads.getThreads, { threadStatus });
  const updateStatus = useMutation(api.threads.updateStatus);

  return (
    <div className="h-full flex flex-col pt-12">
      <div className="space-y-1 p-4">
        {threads?.map((t) => (
          <div
            key={t._id}
            className="relative group rounded-md hover:bg-accent px-3 py-2 bg-card-background"
          >
            <Link
              to={"/threads/" + t.threadId}
              className="flex flex-col sm:flex-row sm:items-center w-full sm:justify-between sm:gap-4 "
            >
              <div className="min-w-0 flex-1 flex-col sm:flex-row flex sm:items-center sm:gap-4">
                <div className="w-full sm:w-80 flex-shrink-0 flex items-center gap-2 justify-between">
                  <div className="text-sm sm:text-sm text-card-foreground font-medium">
                    {t.fromParticipants?.name || t.fromParticipants?.email}
                  </div>
                  <div className="text-xs sm:hidden text-muted-foreground">
                    {new Date(t.lastActivityAt).toLocaleString()}
                  </div>
                </div>
                <div className="font-medium text-xs sm:text-sm text-card-foreground flex-none truncate">
                  {t.subject}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-1">
                  {t.contentPreview}
                </div>
              </div>
              <div className="hidden sm:block flex-shrink-0 text-xs text-muted-foreground pr-20">
                {new Date(t._creationTime).toLocaleString()}
              </div>
            </Link>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 transition-all duration-200 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0">
              <Button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  await updateStatus({
                    threadId: t._id,
                    status: t.status === "pinned" ? undefined : "pinned",
                  });
                }}
                size="icon-sm"
                variant="ghost"
                tooltip={t.status === "pinned" ? "Unpin Thread" : "Pin Thread"}
              >
                {t.status === "pinned" ? (
                  <PinOff className="size-4" />
                ) : (
                  <Pin className="size-4" />
                )}
              </Button>
              <Button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  await updateStatus({
                    threadId: t._id,
                    status: t.status === "archived" ? undefined : "archived",
                  });
                }}
                size="icon-sm"
                variant="ghost"
                tooltip={
                  t.status === "archived"
                    ? "Unarchive Thread"
                    : "Archive Thread"
                }
              >
                {t.status === "archived" ? (
                  <ArchiveRestore className="size-4" />
                ) : (
                  <Archive className="size-4" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
