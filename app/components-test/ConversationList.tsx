import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router";

export function ConversationList() {
  const conversations = useQuery(api.conversations.list, {});

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-4">
          {conversations?.map((c) => (
            <Link
              key={c._id}
              to={"/emails/" + c._id}
              className="flex items-center w-full justify-between gap-4 rounded-md hover:bg-accent px-3 py-2"
            >
              <div className="min-w-0 flex-1 flex items-center gap-4">
                <div className="w-96 flex-shrink-0  text-foreground">
                  {c.fromName || c.fromEmail}
                </div>
                <div className="font-semibold text-foreground flex-none truncate">
                  {c.subject}
                </div>
                <div className="text-sm text-muted-foreground line-clamp-1">
                  <ReactMarkdown>{c.latestMessage.content}</ReactMarkdown>
                </div>
              </div>
              <div className="flex-shrink-0 text-sm text-muted-foreground">
                {new Date(c.lastActivity).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
