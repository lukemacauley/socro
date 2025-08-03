import { Link, useParams } from "react-router";
import { Archive, ArchiveRestore, Pin, PinOff, Search } from "lucide-react";
import { usePaginatedQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "~/components/ui/button";
import { useInfiniteScroll } from "~/lib/use-infinite-scroll";
import { SidebarGroup } from "~/components/ui/sidebar";
import { cn } from "~/lib/utils";

type Thread = (typeof api.threads.getThreads._returnType)["page"][number];
type ThreadStatus = Thread["status"];
type DateSection =
  | "today"
  | "yesterday"
  | "past7days"
  | "past30days"
  | "pinned";

export function SidebarThreadList({ query }: { query: string }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.threads.getThreads,
    { threadStatus: "active", query },
    { initialNumItems: 50 }
  );

  const updateStatus = useMutation(api.threads.updateStatus);

  const observerRef = useInfiniteScroll(() => {
    loadMore(50);
  }, status === "CanLoadMore");

  const groupedThreads = results ? groupThreadsByDate(results) : null;

  const sectionOrder: DateSection[] = [
    "pinned",
    "today",
    "yesterday",
    "past7days",
    "past30days",
  ];

  return (
    <SidebarGroup>
      <div className="space-y-1 px-2">
        {groupedThreads &&
          sectionOrder.map((section) => {
            const sectionThreads = groupedThreads[section];
            if (sectionThreads.length === 0) {
              return null;
            }

            return (
              <div key={section} className="space-y-1">
                <h3 className="text-xs text-muted-foreground whitespace-nowrap">
                  {getSectionTitle(section)}
                </h3>
                <div className="space-y-0.5 pt-1 pb-4">
                  {sectionThreads.map((thread) => (
                    <ThreadItem
                      key={thread._id}
                      thread={thread}
                      updateStatus={updateStatus}
                    />
                  ))}
                </div>
              </div>
            );
          })}
      </div>
      <div ref={observerRef} className="h-1" />
    </SidebarGroup>
  );
}

const ThreadItem = ({
  thread,
  updateStatus,
}: {
  thread: Thread;
  updateStatus: any;
}) => {
  const params = useParams();
  const isCurrentThread = thread.browserId === params.id;

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
    <div
      className={cn(
        "relative group/thread rounded-md hover:bg-accent hover:text-accent-foreground",
        isCurrentThread ? "bg-accent text-accent-foreground" : ""
      )}
    >
      <Link
        to={"/threads/" + thread.browserId}
        className="flex flex-col w-full px-2 py-1.5"
      >
        <div className="font-medium text-sm text-card-foreground truncate">
          {thread.title && thread.title.length > 30
            ? `${thread.title?.substring(0, 30)}...`
            : thread.title}
        </div>
      </Link>
      <div className="absolute right-0 top-0 h-full flex items-center transition-all duration-200 opacity-0 translate-x-2 group-hover/thread:opacity-100 group-hover/thread:translate-x-0 pointer-events-none">
        <div className="h-full flex items-center gap-0.5 pr-1 pl-16 bg-gradient-to-r rounded-md from-transparent via-accent to-accent">
          <div className="h-full flex items-center gap-0.5 pointer-events-auto">
            {statusButtons.map((b) => {
              const isActive = thread.status === b.status;

              return (
                <Button
                  key={b.status}
                  size="icon-sm"
                  variant="ghost"
                  tooltip={isActive ? b.inactiveTooltip : b.activeTooltip}
                  className="hover:!bg-primary hover:!text-primary-foreground cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    updateStatus({
                      threadId: thread._id,
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
        <span className="flex items-center gap-1">
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
