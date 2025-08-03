import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    index("routes/new.tsx"),
    route("threads", "routes/threads/all.tsx"),
    route("threads/:id", "routes/threads/detail.tsx"),
    route("leaderboard", "routes/leaderboard.tsx"),
    route("history", "routes/history.tsx"),
  ]),
] satisfies RouteConfig;
