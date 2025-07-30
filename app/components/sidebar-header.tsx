import { Link } from "react-router";
import { cn } from "~/lib/utils";
import {
  SidebarHeader as SidebarHeaderBase,
  useSidebar,
} from "~/components/ui/sidebar";

export function SidebarHeader() {
  const { state } = useSidebar();

  return (
    <SidebarHeaderBase>
      <Link to="/">
        <h1
          className={cn(
            "font-medium text-xl text-center w-full tracking-tight leading-relaxed text-primary",
            state === "collapsed" ? "text-center" : "text-left px-2"
          )}
        >
          {state === "collapsed" ? "S" : "Socro"}
        </h1>
      </Link>
    </SidebarHeaderBase>
  );
}
