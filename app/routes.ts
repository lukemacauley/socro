import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  layout("routes/layout.tsx", [
    route("assistant", "routes/assistant.tsx"),
    route("emails", "routes/emails/all.tsx"),
    route("emails/:id", "routes/emails/chat.tsx"),
    route("vault", "routes/vault.tsx"),
    route("history", "routes/history.tsx"),
  ]),
] satisfies RouteConfig;
