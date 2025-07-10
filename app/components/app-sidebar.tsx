import * as React from "react";
import {
  MessageSquare,
  Server,
  History,
  type LucideIcon,
  MessagesSquare,
} from "lucide-react";
import { NavMain } from "~/components/nav-main";
import { NavProjects } from "~/components/nav-projects";
// import { NavUser } from "~/components/nav-user";
import { TeamSwitcher } from "~/components/team-switcher";
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
  { title: "Assistant", icon: MessageSquare, url: "/assistant" },
  {
    title: "Emails",
    icon: MessagesSquare,
    url: "/emails",
    // isActive: true,
    // items: [
    //   { title: "All", url: "/emails" },
    //   { title: "New", url: "/emails/new" },
    //   { title: "In Progress", url: "/emails/progress" },
    //   { title: "Resolved", url: "/emails/resolved" },
    // ],
  },
  {
    title: "Vault",
    icon: Server,
    url: "/vault",
  },
  { title: "History", icon: History, url: "/history" },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar();
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link to="/" className="px-2">
          <h1 className="font-bold text-xl tracking-wide leading-relaxed text-green-900 uppercase transition-all">
            {state === "collapsed" ? "C" : "CONGAS"}
          </h1>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={NAVIGATION} />
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
      <SidebarFooter>
        <div className="p-2">
          <SignedOut>
            <SignInButton />
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
        {/* <NavUser user={data.user} /> */}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
