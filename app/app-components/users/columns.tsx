import type { ColumnDef } from "@tanstack/react-table";
import type { api } from "convex/_generated/api";

type LeaderboardUser =
  (typeof api.users.getLeaderboard._returnType)["page"][number];

export const columns: ColumnDef<LeaderboardUser>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "totalPoints",
    header: "Total Points",
  },
  {
    accessorKey: "scenariosCompleted",
    header: "Threads Answered",
  },
  {
    accessorKey: "averageScore",
    header: "Average Score",
  },
  // {
  //   accessorKey: "lastActive",
  //   header: "Last Active",
  // },
];
