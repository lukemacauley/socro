import { SignIn, SignUp, useAuth } from "@clerk/react-router";
import { Separator } from "@radix-ui/react-separator";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "convex/_generated/api";
import { Authenticated, Unauthenticated, useMutation } from "convex/react";
import { LogOut } from "lucide-react";
import { Outlet, useLocation, Link } from "react-router";
import { Fragment } from "react/jsx-runtime";
import { toast } from "sonner";
import { validate } from "uuid";
import { AppSidebar } from "~/components/app-sidebar";
import GhostInput from "~/components/layout/ghost-input";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";

type Breadcrumb = {
  label: string;
  href: string;
  isLast: boolean;
};

export default function Layout() {
  const location = useLocation();
  const { signOut } = useAuth();
  const pathSegments = location.pathname.split("/").filter(Boolean);

  const breadcrumbItems: Breadcrumb[] = [];

  let currentPath = "";

  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === pathSegments.length - 1;

    let label = segment;
    if (segment === "threads") {
      label = "Threads";
    } else if (segment === "new") {
      label = "New";
    } else {
      label = "";
    }

    breadcrumbItems.push({
      label,
      href: currentPath,
      isLast,
    });
  });

  const browserId = pathSegments.pop();
  const isUUID = validate(browserId);

  const threadName = useQuery(
    api.threads.getThreadName,
    isUUID && browserId ? { browserId } : "skip"
  );

  const updateName = useMutation(api.threads.updateThreadName);

  const handleUpdateName = async (newName: string) => {
    try {
      if (browserId) {
        await updateName({ browserId, name: newName });
        toast.success("Thread name updated successfully");
        return;
      }
    } catch (error) {
      toast.error("Failed to update thread name");
      console.error("Error updating thread name:", error);
    }
  };

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
            <header className="sticky w-full px-4 top-0 z-10 flex h-12 shrink-0 items-center justify-center gap-2 border-b border-sidebar-border bg-sidebar">
              <div className="flex flex-1 items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator
                  orientation="vertical"
                  className="mr-2 data-[orientation=vertical]:h-4"
                />
                <Breadcrumb>
                  <BreadcrumbList>
                    {breadcrumbItems.map((item, index) => (
                      <Fragment key={index}>
                        <BreadcrumbItem>
                          {item.isLast ? (
                            <BreadcrumbPage>
                              {isUUID ? (
                                <GhostInput
                                  value={threadName || "New Thread"}
                                  onSave={handleUpdateName}
                                  emptyMessage="Thread name cannot be empty"
                                  className="px-2.5 -ml-2.5 max-w-none w-50"
                                />
                              ) : (
                                threadName || item.label
                              )}
                            </BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link to={item.href}>{item.label}</Link>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                        {index < breadcrumbItems.length - 1 && (
                          <BreadcrumbSeparator />
                        )}
                      </Fragment>
                    ))}
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                tooltip="Sign out"
              >
                <LogOut />
              </Button>
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
