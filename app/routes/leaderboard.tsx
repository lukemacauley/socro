import { usePaginatedQuery } from "convex-helpers/react/cache";
import { api } from "convex/_generated/api";
import { columns } from "~/app-components/users/columns";
import { InfiniteScrollDataTable } from "~/app-components/users/infinite-scroll-data-table";
import { useState } from "react";
import type { Route } from "./+types/leaderboard";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Leaderboard - Socro" },
    {
      name: "description",
      content: "View the Socro leaderboard and see top performers.",
    },
    { property: "og:title", content: "Leaderboard - Socro" },
    {
      property: "og:description",
      content: "View the Socro leaderboard and see top performers.",
    },
  ];
};

export default function Page() {
  const [sortConfig, setSortConfig] = useState<{
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }>({
    sortBy: "totalPoints",
    sortOrder: "desc",
  });

  const paginatedQuery = usePaginatedQuery(
    api.users.getLeaderboard,
    sortConfig,
    {
      initialNumItems: 50,
    }
  );

  const handleSort = (column: string) => {
    setSortConfig((prev) => ({
      sortBy: column,
      sortOrder:
        prev.sortBy === column && prev.sortOrder === "desc" ? "asc" : "desc",
    }));
  };

  return (
    <div className="container mx-auto p-4">
      <InfiniteScrollDataTable
        columns={columns}
        paginatedQuery={paginatedQuery}
        sortConfig={sortConfig}
        onSort={handleSort}
      />
    </div>
  );
}
