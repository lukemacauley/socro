import { useQuery } from "convex-helpers/react/cache";
import { api } from "convex/_generated/api";
import { Link } from "react-router";

export function ConversationList() {
  const threads = useQuery(api.threads.getThreads, {});

  return (
    <div className="h-full flex flex-col">
      <div className="space-y-1 p-4">
        {threads?.map((t) => (
          <Link
            key={t._id}
            to={"/threads/" + t._id}
            className="flex flex-col sm:flex-row sm:items-center w-full sm:justify-between sm:gap-4 rounded-md hover:bg-accent px-3 py-2"
          >
            <div className="min-w-0 flex-1 flex-col sm:flex-row flex sm:items-center sm:gap-4">
              <div className="w-40 sm:w-96 flex-shrink-0  text-foreground">
                {t.fromParticipants.name || t.fromParticipants.email}
              </div>
              <div className="font-semibold text-foreground flex-none truncate">
                {t.subject}
              </div>
              <div className="text-sm text-muted-foreground line-clamp-1">
                {t.contentPreview}
              </div>
            </div>
            <div className="flex-shrink-0 text-sm text-muted-foreground">
              {new Date(t.lastActivityAt).toLocaleString()}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
