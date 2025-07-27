import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Toaster } from "./components/ui/sonner";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache";
import { env } from "env";
import { Separator } from "@radix-ui/react-separator";
import { AppSidebar } from "./components/app-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "./components/ui/sidebar";
import { AuthKitProvider } from "@workos-inc/authkit-react";

export function HydrateFallback() {
  return (
    <SidebarProvider>
      <AppSidebar isFallback />
      <SidebarInset>
        <header className="fixed w-full top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
          </div>
        </header>
        <div className="bg-primary-foreground">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=TikTok+Sans:opsz,wdth,wght@12..36,75..150,300..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        {/* <script
          crossOrigin="anonymous"
          src="//unpkg.com/react-scan/dist/auto.global.js"
        /> */}
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Toaster position="top-right" expand />
        <Scripts />
      </body>
    </html>
  );
}

const convex = new ConvexReactClient(env.VITE_CONVEX_URL);

export default function App(_args: Route.ComponentProps) {
  return (
    <AuthKitProvider clientId={env.VITE_WORKOS_CLIENT_ID}>
      <ConvexProvider client={convex}>
        <ConvexQueryCacheProvider>
          <Outlet />
        </ConvexQueryCacheProvider>
      </ConvexProvider>
    </AuthKitProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
