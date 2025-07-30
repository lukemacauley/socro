import {
  MessageSquare,
  MessagesSquare,
  Crown,
  type LucideIcon,
} from "lucide-react";
import { NavMain } from "./nav-main";

const NAVIGATION: {
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

export function SidebarCollapsed() {
  return <NavMain items={NAVIGATION} />;
}
