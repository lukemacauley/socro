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

export default function Layout() {
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);

  // Build breadcrumb items based on current path
  const breadcrumbItems: {
    label: string;
    href: string;
    isLast: boolean;
  }[] = [];

  // // Always show Home as first item
  // breadcrumbItems.push({
  //   label: "Home",
  //   href: "/",
  //   isLast: pathSegments.length === 0,
  // });

  // Build up the path for each segment
  let currentPath = "";
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === pathSegments.length - 1;

    // Format the label
    let label = segment;
    if (segment === "emails") {
      label = "Emails";
    } else if (segment === "new") {
      label = "New";
    } else {
      label = "Conversation";
    }

    breadcrumbItems.push({
      label,
      href: currentPath,
      isLast,
    });
  });

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background">
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
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
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
        <div className="flex flex-1 flex-col gap-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
