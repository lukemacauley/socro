import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
} from "~/components/ui/sidebar";
import { SidebarHeader } from "./sidebar-header";
import { SidebarThreadList } from "./sidebar-thread-list";
import { useState } from "react";
import { NavUser } from "./nav-user";

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar> & { isFallback?: boolean }) {
  const [query, setQuery] = useState("");
  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader query={query} setQuery={setQuery} />
      <SidebarContent>
        <SidebarThreadList query={query} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
