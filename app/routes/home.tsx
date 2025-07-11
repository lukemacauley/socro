import { SignInButton } from "@clerk/react-router";
import { Unauthenticated, useConvexAuth } from "convex/react";
import type { Route } from "./+types/home";
import { Button } from "~/components/ui/button";
import { useEffect } from "react";

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = "/threads";
    }
  }, [isAuthenticated]);

  return (
    <Unauthenticated>
      <SignInButton
        children={<Button>Sign In</Button>}
        mode="modal"
        oauthFlow="popup"
        withSignUp
      />
    </Unauthenticated>
  );
}
