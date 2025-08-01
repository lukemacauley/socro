import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarRail,
  useSidebar,
} from "~/components/ui/sidebar";
import { SidebarHeader } from "./sidebar-header";
import { SidebarCollapsed } from "./sidebar-collapsed";
import { SidebarThreadList } from "./sidebar-thread-list";
import { useState } from "react";

function SidebarContentWrapper({ query }: { query: string }) {
  const { state } = useSidebar();

  if (state === "collapsed") {
    return <SidebarCollapsed />;
  }

  return <SidebarThreadList query={query} />;
}

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar> & { isFallback?: boolean }) {
  const [query, setQuery] = useState("");
  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader query={query} setQuery={setQuery} />
      <SidebarContent>
        <SidebarContentWrapper query={query} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
