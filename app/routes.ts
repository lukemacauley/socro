import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("emails/:id", "routes/emails/chat.tsx"),
    route("emails", "routes/emails/all.tsx"),
  ]),
] satisfies RouteConfig;
