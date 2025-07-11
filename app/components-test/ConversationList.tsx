import { useQuery } from "convex-helpers/react/cache";
import { api } from "convex/_generated/api";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router";

export function ConversationList() {
  const threads = useQuery(api.threads.getThreads, {});

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-4">
          {threads?.map((t) => (
            <Link
              key={t._id}
              to={"/threads/" + t._id}
              className="flex items-center w-full justify-between gap-4 rounded-md hover:bg-accent px-3 py-2"
            >
              <div className="min-w-0 flex-1 flex items-center gap-4">
                <div className="w-96 flex-shrink-0  text-foreground">
                  {t.fromParticipants.name || t.fromParticipants.email}
                </div>
                <div className="font-semibold text-foreground flex-none truncate">
                  {t.subject}
                </div>
                <div className="text-sm text-muted-foreground line-clamp-1">
                  <ReactMarkdown>{t.latestMessage?.content}</ReactMarkdown>
                </div>
              </div>
              <div className="flex-shrink-0 text-sm text-muted-foreground">
                {new Date(t.lastActivityAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
