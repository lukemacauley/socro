import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("emails/new", "routes/emails/new.tsx"),
    route("emails/:id", "routes/emails/chat.tsx"),
    route("emails", "routes/emails/all.tsx"),
  ]),
  route("/api/webhooks/microsoft/email", "routes/email.tsx"),
] satisfies RouteConfig;
