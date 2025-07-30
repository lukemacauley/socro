import * as React from "react";
import {
  type LucideIcon,
  MessageSquare,
  MessagesSquare,
  Crown,
} from "lucide-react";
import { NavMain } from "~/components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "~/components/ui/sidebar";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export const NAVIGATION: {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: {
    title: string;
    url: string;
  }[];
}[] = [
  { title: "New Chat", icon: MessageSquare, url: "/" },
  {
    title: "Threads",
    icon: MessagesSquare,
    url: "/threads",
  },
  {
    title: "Leaderboard",
    icon: Crown,
    url: "/leaderboard",
  },
];

export function AppSidebar({
  isFallback,
  ...props
}: React.ComponentProps<typeof Sidebar> & { isFallback?: boolean }) {
  const { state } = useSidebar();
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link to="/">
          <h1
            className={cn(
              "font-medium text-xl tracking-tight leading-relaxed text-primary",
              state === "collapsed" ? "text-center" : "text-left px-2"
            )}
          >
            {state === "collapsed" ? "S" : "Socro"}
          </h1>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={NAVIGATION} />
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>

      {/* <SidebarFooter>
        {!isFallback && (
          <div className="p-2">
            <SignedOut>
              <SignInButton />
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        )}
      </SidebarFooter> */}
      <SidebarRail />
    </Sidebar>
  );
}
