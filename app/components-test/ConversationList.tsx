import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useState } from "react";

export function ConversationList() {
  const [selectedConversationId, setSelectedConversationId] =
    useState<Id<"conversations"> | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "new" | "in_progress" | "resolved" | undefined
  >(undefined);
  const conversations = useQuery(api.conversations.list, {
    status: statusFilter,
  });

  if (conversations === undefined) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-3">Email Conversations</h2>

        {/* Status filter */}
        <div className="flex gap-1">
          <button
            onClick={() => setStatusFilter(undefined)}
            className={`px-3 py-1 text-sm rounded ${
              statusFilter === undefined
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter("new")}
            className={`px-3 py-1 text-sm rounded ${
              statusFilter === "new"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            New
          </button>
          <button
            onClick={() => setStatusFilter("in_progress")}
            className={`px-3 py-1 text-sm rounded ${
              statusFilter === "in_progress"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            In Progress
          </button>
          <button
            onClick={() => setStatusFilter("resolved")}
            className={`px-3 py-1 text-sm rounded ${
              statusFilter === "resolved"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Resolved
          </button>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No conversations found</p>
            <p className="text-sm mt-1">
              New emails will appear here automatically
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {conversations.map((conversation) => (
              <div
                key={conversation._id}
                onClick={() => setSelectedConversationId(conversation._id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedConversationId === conversation._id
                    ? "bg-blue-50 border border-blue-200"
                    : "hover:bg-gray-50 border border-transparent"
                }`}
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
                    {conversation.latestMessage.type === "ai_response" &&
                      "AI: "}
                    {conversation.latestMessage.content}
                  </p>
                )}

                <p className="text-xs text-gray-400 mt-1">
                  {new Date(conversation.lastActivity).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
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
