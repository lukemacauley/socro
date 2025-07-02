import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/api/webhooks/microsoft/email", "routes/email.tsx"),
] satisfies RouteConfig;
