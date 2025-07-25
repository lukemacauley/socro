import { usePaginatedQuery } from "convex-helpers/react/cache";
import { api } from "convex/_generated/api";
import { columns } from "~/app-components/users/columns";
import { DataTable } from "~/app-components/users/data-table";

export default function Page() {
  const { results, loadMore, status } = usePaginatedQuery(
    api.users.getLeaderboard,
    {},
    {
      initialNumItems: 50,
    }
  );

  return (
    <div className="container mx-auto py-20 px-4">
      <DataTable columns={columns} data={results} />
    </div>
  );
}
