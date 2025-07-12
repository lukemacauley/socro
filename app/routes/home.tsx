import { SignInButton, useAuth } from "@clerk/react-router";
import { Unauthenticated } from "convex/react";
import type { Route } from "./+types/home";
import { Button } from "~/components/ui/button";
import { useEffect } from "react";

export default function Profile({ loaderData: _ }: Route.ComponentProps) {
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      window.location.href = "/threads";
    }
  }, [isSignedIn]);

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
