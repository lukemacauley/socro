import { SignIn } from "@clerk/react-router";
import type { Route } from "./+types/home";

export default function Home({}: Route.ComponentProps) {
  return (
    <div className="flex items-center justify-center h-screen w-full">
      <SignIn
        oauthFlow="popup"
        afterSignOutUrl="/"
        fallbackRedirectUrl="/threads"
        withSignUp
      />
    </div>
  );
}
