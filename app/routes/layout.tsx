import { useAuth } from "@workos-inc/authkit-react";
import { Authenticated, Unauthenticated } from "convex/react";
import { Outlet } from "react-router";
import { AppSidebar } from "~/components/app-sidebar";
import { Button } from "~/components/ui/button";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";

export default function Layout() {
  const { signOut, signIn, signUp } = useAuth();

  return (
    <TooltipProvider>
      <Unauthenticated>
        <div className="flex items-center justify-center h-screen gap-8 w-full">
          <Button onClick={() => signIn()}>Sign In</Button>
          <Button onClick={() => signUp()}>Sign Up</Button>
        </div>
      </Unauthenticated>
      <Authenticated>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <div className="bg-primary-foreground">
              <Outlet />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </Authenticated>
    </TooltipProvider>
  );
}
