import { usePaginatedQuery } from "convex-helpers/react/cache";
import { api } from "convex/_generated/api";
import { Link } from "react-router";
import { Archive, ArchiveRestore, Pin, PinOff } from "lucide-react";
import { useMutation } from "convex/react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import RelativeTime from "~/components/relative-time";
import { useInfiniteScroll } from "~/lib/use-infinite-scroll";

type Thread = (typeof api.threads.getThreads._returnType)["page"][number];
type ThreadStatus = Thread["status"];
type DateSection =
  | "today"
  | "yesterday"
  | "past7days"
  | "past30days"
  | "pinned";

export function ConversationList({
  threadStatus,
}: {
  threadStatus?: ThreadStatus;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.threads.getThreads,
    { threadStatus },
    { initialNumItems: 50 }
  );

  const groupedThreads = results ? groupThreadsByDate(results) : null;

  const sectionOrder: DateSection[] = [
    "pinned",
    "today",
    "yesterday",
    "past7days",
    "past30days",
  ];

  const observerRef = useInfiniteScroll(() => {
    loadMore(50);
  }, status === "CanLoadMore");

  return (
    <div className="h-full flex flex-col">
      <div className="py-3">
        {groupedThreads &&
          sectionOrder.map((section) => {
            const sectionThreads = groupedThreads[section];
            if (sectionThreads.length === 0) {
              return null;
            }

            return (
              <div key={section} className="space-y-1">
                <div className="flex items-center gap-4">
                  <h3 className="text-xs text-muted-foreground">
                    {getSectionTitle(section)}
                  </h3>
                  <div className="h-px flex-auto bg-sidebar-border" />
                </div>
                <div className="space-y-1 pt-1 pb-6">
                  {sectionThreads.map((t) => (
                    <ThreadItem t={t} key={t._id} />
                  ))}
                </div>
              </div>
            );
          })}
      </div>
      <div ref={observerRef} className="h-1" />
    </div>
  );
}

const ThreadItem = ({ t }: { t: Thread }) => {
  const updateStatus = useMutation(api.threads.updateStatus);
  const setIsOpened = useMutation(api.threads.setIsOpened);

  const statusButtons = [
    {
      status: "pinned" as ThreadStatus,
      activeTooltip: "Pin thread",
      inactiveTooltip: "Unpin thread",
      icon: Pin,
      inactiveIcon: PinOff,
    },
    {
      status: "archived" as ThreadStatus,
      activeTooltip: "Archive thread",
      inactiveTooltip: "Unarchive thread",
      icon: Archive,
      inactiveIcon: ArchiveRestore,
    },
  ];

  return (
    <div className="relative group rounded-md hover:bg-accent hover:text-accent-foreground">
      <Link
        to={"/threads/" + t.threadId}
        onClick={() => setIsOpened({ threadId: t._id })}
        className="flex flex-col sm:flex-row sm:items-center w-full sm:justify-between sm:gap-3 px-3 py-2 "
      >
        <div
          className={cn(
            "size-1.5 absolute left-0",
            t.opened ? "invisible" : "relative flex"
          )}
        >
          <span className="bg-emerald-500 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </div>
        <div className="min-w-0 flex-1 flex-col sm:flex-row flex sm:items-center sm:gap-3">
          {/* <div className="w-full sm:w-80 flex-shrink-0 flex items-center gap-2 justify-between">
            <div className="text-sm sm:text-sm text-card-foreground font-medium">
              {t.fromParticipants?.name || t.fromParticipants?.email}
            </div>
            <div className="text-xs sm:hidden text-muted-foreground">
              <RelativeTime date={t.lastActivityAt} />
            </div>
          </div> */}
          <div
            className={cn(
              "font-medium text-xs sm:text-sm text-card-foreground flex-none truncate"
            )}
          >
            {t.subject && t.subject.length > 60
              ? `${t.subject?.substring(0, 60)}...`
              : t.subject}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-1">
            {t.contentPreview}
          </div>
        </div>
        <div className="hidden sm:block flex-shrink-0 text-xs text-muted-foreground pr-20">
          <RelativeTime date={t.lastActivityAt} />
        </div>
      </Link>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 transition-all duration-200 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0">
        {statusButtons.map((b) => {
          const isActive = t.status === b.status;
          return (
            <Button
              key={b.status}
              size="icon-sm"
              variant="ghost"
              tooltip={isActive ? b.inactiveTooltip : b.activeTooltip}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                updateStatus({
                  threadId: t._id,
                  status: isActive ? undefined : b.status,
                });
              }}
            >
              {isActive ? (
                <b.inactiveIcon className="size-4" />
              ) : (
                <b.icon className="size-4" />
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

function getDateSection(date: number): DateSection {
  const now = new Date();
  const messageDate = new Date(date);

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const startOfYesterday = new Date(
    startOfToday.getTime() - 24 * 60 * 60 * 1000
  );
  const past7Days = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const past30Days = new Date(
    startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000
  );

  if (messageDate >= startOfToday) {
    return "today";
  } else if (messageDate >= startOfYesterday) {
    return "yesterday";
  } else if (messageDate >= past7Days) {
    return "past7days";
  } else if (messageDate >= past30Days) {
    return "past30days";
  }

  return "past30days";
}

function getSectionTitle(section: DateSection) {
  switch (section) {
    case "pinned":
      return (
        <span className="flex items-center pl-1 gap-2">
          <Pin className="size-3" />
          Pinned
        </span>
      );
    case "today":
      return "Today";
    case "yesterday":
      return "Yesterday";
    case "past7days":
      return "Past 7 days";
    case "past30days":
      return "Past 30 days";
  }
}

function groupThreadsByDate(threads: Thread[]): Record<DateSection, Thread[]> {
  const groups: Record<DateSection, Thread[]> = {
    pinned: [],
    today: [],
    yesterday: [],
    past7days: [],
    past30days: [],
  };

  threads.forEach((thread) => {
    const section = getDateSection(thread.lastActivityAt);
    if (thread.status === "pinned") {
      groups.pinned.push(thread);
      return;
    }
    groups[section].push(thread);
  });

  return groups;
}
