import { useQuery } from "convex-helpers/react/cache";
import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { Outlet, useLocation, Link } from "react-router";
import { Fragment } from "react/jsx-runtime";
import { toast } from "sonner";
import { AppSidebar } from "~/components/app-sidebar";
import GhostInput from "~/components/layout/ghost-input";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { validate } from "uuid";

type Breadcrumb = {
  label: string;
  href: string;
  isLast: boolean;
};

export default function Layout() {
  const location = useLocation();
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

  const threadId = pathSegments.pop();
  const isUUID = validate(threadId);

  const threadName = useQuery(
    api.threads.getThreadName,
    isUUID && threadId ? { threadId } : "skip"
  );

  const updateName = useMutation(api.threads.updateThreadName);

  const handleUpdateName = async (newName: string) => {
    try {
      if (threadId) {
        await updateName({ threadId, name: newName });
        toast.success("Thread name updated successfully");
        return;
      }
    } catch (error) {
      toast.error("Failed to update thread name");
      console.error("Error updating thread name:", error);
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="fixed w-full top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar">
          <div className="flex items-center gap-2 px-4">
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
        </header>
        <div className="bg-primary-foreground">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
