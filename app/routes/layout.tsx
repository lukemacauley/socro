import { SignIn, SignUp, useAuth } from "@clerk/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { Archive, LogOut } from "lucide-react";
import { Outlet, Link } from "react-router";
import { AppSidebar } from "~/components/app-sidebar";
import { Button } from "~/components/ui/button";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";

export default function Layout() {
  const { signOut } = useAuth();

  return (
    <TooltipProvider>
      <Unauthenticated>
        <div className="flex items-center justify-center h-screen gap-8 w-full">
          <SignIn oauthFlow="popup" afterSignOutUrl="/" />
          <SignUp oauthFlow="popup" afterSignOutUrl="/" />
        </div>
      </Unauthenticated>
      <Authenticated>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="sticky w-full px-4 top-0 z-10 flex h-12 shrink-0 items-center justify-center gap-2">
              <div className="flex items-center justify-end flex-1 gap-0.5">
                <Button variant="ghost" size="sm" tooltip="Archive" asChild>
                  <Link to="/threads?status=archived">
                    <Archive />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut()}
                  tooltip="Sign out"
                >
                  <LogOut />
                </Button>
              </div>
            </header>
            <div className="bg-primary-foreground">
              <Outlet />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </Authenticated>
    </TooltipProvider>
  );
}
