import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export function ConversationList() {
  const conversations = useQuery(api.conversations.list, {});

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-4">
          {conversations?.map((conversation) => (
            <Link
              key={conversation._id}
              to={"/emails/" + conversation._id}
              className={cn(
                "flex items-center max-w-screen-xl w-full justify-start gap-4 rounded-lg"
              )}
            >
              <div className="w-60 flex-none">
                {conversation.fromName || conversation.fromEmail}
              </div>

              <div className="flex flex-none items-center gap-4">
                <div className="font-bold flex-none">
                  {conversation.subject}
                </div>
                <div className="truncate flex-none line-clamp-1 text-zinc-500">
                  <ReactMarkdown>
                    {conversation.latestMessage.content}
                  </ReactMarkdown>
                </div>
              </div>

              <div className="flex-none text-zinc-600 w-40">
                {new Date(conversation.lastActivity).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
