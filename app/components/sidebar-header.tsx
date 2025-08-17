import { Link } from "react-router";
import { SidebarHeader as SidebarHeaderBase } from "~/components/ui/sidebar";
import { Search } from "lucide-react";
import { Button } from "./ui/button";

export function SidebarHeader({
  query,
  setQuery,
}: {
  query: string;
  setQuery: (query: string) => void;
}) {
  return (
    <SidebarHeaderBase>
      <div className="w-full my-4 flex items-center justify-center">
        <Link to="/">
          <img src="/socro-logo.svg" alt="Socro Logo" className="h-8" />
        </Link>
      </div>
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
