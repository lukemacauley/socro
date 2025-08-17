import { useAuth } from "@workos-inc/authkit-react";
import { Authenticated, Unauthenticated } from "convex/react";
import { Link, Outlet } from "react-router";
import { AppSidebar } from "~/components/app-sidebar";
import { Button } from "~/components/ui/button";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";
import { MeshGradient } from "@paper-design/shaders-react";

export default function Layout() {
  const { signIn, signUp } = useAuth();

  return (
    <TooltipProvider>
      <Unauthenticated>
        <div className="fixed top-0 inset-x-0 z-50 w-full">
          <div className="flex items-center bg-primary-foreground justify-between py-4 max-w-screen-xl w-full mx-auto">
            <div className="">
              <Link to="/">
                <img src="/socro-logo.svg" alt="Socro Logo" className="h-7.5" />
              </Link>
            </div>
            <div className=" flex items-center gap-2">
              <Button variant="outline" onClick={() => signIn()}>
                Sign In
              </Button>
              <Button asChild>
                <Link to="mailto:info@socro.ai">Book a Demo</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="max-w-screen-xl mx-auto flex flex-col gap-20 mb-20">
          <div className="pt-88">
            <h1 className="text-5xl leading-tight">
              Develop the strategic thinking and judgment
              <br />
              that make senior partners irreplaceable.
            </h1>
          </div>
          <div className="relative">
            <MeshGradient
              colors={["#dad9d4", "#535146", "#ffcc00", "#ede9de"]}
              distortion={1}
              swirl={0.8}
              speed={0.1}
              style={{ width: "100%", height: "800px" }}
            />
            <img
              src="/hero.png"
              alt="Socro Hero"
              className="w-4/5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            />
          </div>
        </div>
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
