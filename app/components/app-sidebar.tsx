import * as React from "react";
import {
  MessageSquare,
  Server,
  History,
  type LucideIcon,
  MessagesSquare,
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
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/react-router";
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
  { title: "Chat", icon: MessageSquare, url: "/new" },
  {
    title: "Threads",
    icon: MessagesSquare,
    url: "/threads",
    // isActive: true,
    // items: [
    //   { title: "All", url: "/threads" },
    //   { title: "New", url: "/threads?status=new" },
    //   // { title: "In Progress", url: "/threads/?status=in_progress" },
    //   { title: "Archived", url: "/threads?status=archived" },
    // ],
  },
  {
    title: "Vault",
    icon: Server,
    url: "/vault",
  },
  { title: "History", icon: History, url: "/history" },
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
            {state === "collapsed" ? "CG" : "Con Gas"}
          </h1>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={NAVIGATION} />
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>

      <SidebarFooter>
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
        {/* <NavUser user={data.user} /> */}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
