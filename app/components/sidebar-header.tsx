import { Link } from "react-router";
import { cn } from "~/lib/utils";
import {
  SidebarHeader as SidebarHeaderBase,
  useSidebar,
} from "~/components/ui/sidebar";
import { Search } from "lucide-react";
import { Button } from "./ui/button";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "convex/_generated/api";

export function SidebarHeader({
  query,
  setQuery,
}: {
  query: string;
  setQuery: (query: string) => void;
}) {
  const { state } = useSidebar();
  const user = useQuery(api.users.current);
  const isAdmin = user?.role === "admin";

  return (
    <SidebarHeaderBase>
      <Link to="/">
        <h1
          className={cn(
            "font-medium text-xl  w-full tracking-tight text-center px-2 leading-relaxed text-primary"
          )}
        >
          {state === "collapsed" ? "S" : "Socro"}
        </h1>
      </Link>
      {/* {isAdmin && ( */}
      <Button variant="secondary" asChild>
        <Link to="/leaderboard" className="w-full">
          Leaderboard
        </Link>
      </Button>
      {/* )} */}
      <Button asChild className="w-full" size="sm">
        <Link to="/">New Chat</Link>
      </Button>
      <div className="border-b border-sidebar-border flex items-center gap-2 p-2">
        <Search className="size-4" />
        <input
          placeholder="Search threads..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="text-sm ring-0 focus:ring-0 w-full bg-transparent placeholder:text-muted-foreground outline-none"
        />
      </div>
    </SidebarHeaderBase>
  );
}
