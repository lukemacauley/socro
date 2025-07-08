import { api } from "convex/_generated/api";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export function ConversationList() {
  const conversations = useQuery(api.conversations.list, {});

  const threads = usePaginatedQuery(
    api.agent.listThreads,
    {},
    {
      initialNumItems: 20,
    }
  );

  return (
    <div className="h-full flex flex-col">
      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-2">
          {threads.results?.map((conversation) => (
            <Link
              key={conversation._id}
              to={"/emails/" + conversation._id}
              className={cn(
                "p-3 block rounded-lg cursor-pointer transition-colors",
                // selectedConversationId === conversation._id
                //   ? "bg-blue-50 border border-blue-200"
                // :
                "hover:bg-gray-50 border border-transparent"
              )}
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-medium text-sm truncate flex-1 mr-2">
                  {conversation.title}
                </h3>
                {/* <StatusBadge status={conversation.status} /> */}
              </div>

              {/* <p className="text-xs text-gray-600 mb-1">
                From: {conversation.fromName || conversation.fromEmail}
              </p> */}

              {/* {conversation.latestMessage && (
                <p className="text-xs text-gray-500 truncate">
                  {conversation.latestMessage.type === "ai_response" && "AI: "}
                  {conversation.latestMessage.content}
                </p>
                )}*/}
              <p className="text-xs text-gray-500 truncate">
                {conversation.summary}
              </p>

              {/* <p className="text-xs text-gray-400 mt-1">
                {new Date(conversation.lastActivity).toLocaleDateString()}
              </p>  */}
            </Link>
          ))}
          {/* {conversations?.map((conversation) => (
            <Link
              key={conversation._id}
              to={"/emails/" + conversation._id}
              className={cn(
                "p-3 block rounded-lg cursor-pointer transition-colors",
                // selectedConversationId === conversation._id
                //   ? "bg-blue-50 border border-blue-200"
                // :
                "hover:bg-gray-50 border border-transparent"
              )}
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-medium text-sm truncate flex-1 mr-2">
                  {conversation.subject}
                </h3>
                <StatusBadge status={conversation.status} />
              </div>

              <p className="text-xs text-gray-600 mb-1">
                From: {conversation.fromName || conversation.fromEmail}
              </p>

              {conversation.latestMessage && (
                <p className="text-xs text-gray-500 truncate">
                  {conversation.latestMessage.type === "ai_response" && "AI: "}
                  {conversation.latestMessage.content}
                </p>
              )}

              <p className="text-xs text-gray-400 mt-1">
                {new Date(conversation.lastActivity).toLocaleDateString()}
              </p>
            </Link>
          ))} */}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "new" | "in_progress" | "resolved";
}) {
  const colors = {
    new: "bg-green-100 text-green-700",
    in_progress: "bg-yellow-100 text-yellow-700",
    resolved: "bg-gray-100 text-gray-700",
  };

  const labels = {
    new: "New",
    in_progress: "In Progress",
    resolved: "Resolved",
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}
