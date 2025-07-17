import { useQuery } from "convex-helpers/react/cache";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Outlet, useLocation, Link } from "react-router";
import { Fragment } from "react/jsx-runtime";
import { AppSidebar } from "~/components/app-sidebar";
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

type Breadcrumb = {
  label: string;
  href: string;
  isLast: boolean;
};

export default function Layout() {
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);

  const breadcrumbItems: Breadcrumb[] = [];

  let isId = false;
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
      isId = true;
    }

    breadcrumbItems.push({
      label,
      href: currentPath,
      isLast,
    });
  });

  const threadId = pathSegments.pop();

  const threadName = useQuery(
    api.threads.getThreadName,
    isId && threadId ? { id: threadId as Id<"threads"> } : "skip"
  );

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
                          {threadName || item.label}
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
