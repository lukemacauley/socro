// import { Button } from "~/components/ui/button";
import type { Route } from "./+types/home";
// import { useAuth } from "@workos-inc/authkit-react";
import { SignIn, SignUp } from "@clerk/react-router";

export default function Home({}: Route.ComponentProps) {
  // const { signIn, signUp, user } = useAuth();

  // if (user) {
  //   return (
  //     <div className="flex items-center justify-center h-screen gap-8 w-full">
  //       <h1>Welcome, {user.firstName}!</h1>
  //     </div>
  //   );
  // }

  return (
    <div className="flex items-center justify-center h-screen gap-8 w-full">
      <SignIn
        oauthFlow="popup"
        afterSignOutUrl="/"
        // fallbackRedirectUrl="/threads"
        withSignUp={true}
      />
      <SignUp
        oauthFlow="popup"
        afterSignOutUrl="/"
        // fallbackRedirectUrl="/threads"
      />
    </div>
  );
}
