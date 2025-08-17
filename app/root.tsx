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
import { ConvexReactClient } from "convex/react";
import { Toaster } from "./components/ui/sonner";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache";
import { env } from "env";
import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react";
import { ConvexProviderWithAuthKit } from "@convex-dev/workos";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "./components/ui/sidebar";

// Enabling lawyers to be better thinkers
// "While AI drafts the documents, master the questions that win the case."
// "Transform legal minds through questions AI can't ask."
// "Build the judgment AI can't replace."
// "Question deeper. Lead further."
// The Partnership Track Focus: "The questions that separate associates from partners."
// The Craft Angle: "Sharpen the thinking AI can't automate."
// The Competitive Edge: "Think like the partner AI works for."
// The Evolution Play: "From legal processor to strategic counselor."
// The Direct Challenge: "Don't just know the law. Question it."
// The Wisdom Builder: "Questions that build legal instinct, not just knowledge."
// The Future-Proof Angle: "Master the art AI can't learn."
// The Clarity Through Questions: "Cut through complexity with surgical questions."
// The Leadership Development: "Think in questions. Lead in solutions."
// The Socratic Power Play: "Weaponize curiosity. Dominate the boardroom."
// The Transformation Promise: "Turn good lawyers into irreplaceable advisors."
// The Brutal Truth: "AI writes briefs. Partners write futures."

// "A Socratic questioning app that develops the strategic thinking and judgment that make senior partners irreplaceable. While AI handles legal research and drafting, master the critical analysis, client counseling, and complex problem-solving that define legal leadership. Transform from lawyer to trusted advisor through guided questioning that sharpens instincts AI will never have."

// "Develop the strategic legal thinking AI can't replace. Socratic questioning app that builds the judgment and instincts that make senior partners invaluable."

const title = "Socro — Sharpen the thinking AI can't automate";
const description =
  "Develop the strategic legal thinking AI can't replace. Socratic questioning app that builds the judgment and instincts that make senior partners invaluable.";

export const meta: Route.MetaFunction = () => {
  return [
    { title },
    { name: "description", content: description },
    { name: "author", content: "Socro" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Socro" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
};

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
  {
    rel: "preload",
    href: "/fonts/PPEditorialOld-Ultrabold.otf",
    as: "font",
    type: "font/otf",
    crossOrigin: "anonymous",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: "/favicon.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: "/favicon.png",
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

export default function App() {
  return (
    <AuthKitProvider
      clientId={env.VITE_WORKOS_CLIENT_ID}
      redirectUri={env.VITE_WORKOS_REDIRECT_URI}
    >
      <ConvexProviderWithAuthKit client={convex} useAuth={useAuth}>
        <ConvexQueryCacheProvider>
          <Outlet />
        </ConvexQueryCacheProvider>
      </ConvexProviderWithAuthKit>
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

export function HydrateFallback() {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header />
        <div className="bg-primary-foreground">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
