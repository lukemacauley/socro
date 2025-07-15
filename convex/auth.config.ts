import { env } from "../env";

export default {
  providers: [
    {
      domain: env.VITE_CLERK_FRONTEND_API_URL,
      applicationID: "convex",
    },
  ],
};
