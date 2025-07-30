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

function SidebarContentWrapper({ isFallback }: { isFallback?: boolean }) {
  const { state } = useSidebar();

  if (isFallback || state === "collapsed") {
    return <SidebarCollapsed />;
  }

  return <SidebarThreadList />;
}

export function AppSidebar({
  isFallback,
  ...props
}: React.ComponentProps<typeof Sidebar> & { isFallback?: boolean }) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader />
      <SidebarContent>
        <SidebarContentWrapper isFallback={isFallback} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
