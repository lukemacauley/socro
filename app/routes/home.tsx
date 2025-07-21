import { SignIn, SignUp } from "@clerk/react-router";
import type { Route } from "./+types/home";

export default function Home({}: Route.ComponentProps) {
  return (
    <div className="flex items-center justify-center h-screen gap-8 w-full">
      <SignIn
        oauthFlow="popup"
        afterSignOutUrl="/"
        fallbackRedirectUrl="/threads"
        withSignUp={true}
      />
      <SignUp
        oauthFlow="popup"
        afterSignOutUrl="/"
        fallbackRedirectUrl="/threads"
      />
    </div>
  );
}
