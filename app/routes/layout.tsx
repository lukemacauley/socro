import { useAuth } from "@workos-inc/authkit-react";
import { Authenticated, Unauthenticated } from "convex/react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { AppSidebar } from "~/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";

export default function Layout() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const allowedPaths = ["/", "/demo", "demo-success"];

  if (!isLoading && !user && !allowedPaths.includes(pathname)) {
    navigate("/");
  }

  return (
    <TooltipProvider>
      <Unauthenticated>
        <Outlet />
      </Unauthenticated>
      <Authenticated>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </Authenticated>
    </TooltipProvider>
  );
}
