import Threads from "~/components-test/ThreadsPage";
import type { Route } from "./+types/all";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Threads - Socro" },
    {
      name: "description",
      content:
        "Browse your threads on Socro. Access your history and continue discussions.",
    },
    { property: "og:title", content: "Threads - Socro" },
    {
      property: "og:description",
      content:
        "Browse your threads on Socro. Access your history and continue discussions.",
    },
  ];
};

export default function Page(_: Route.ComponentProps) {
  return <Threads />;
}
