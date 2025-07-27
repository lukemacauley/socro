import { Button } from "~/components/ui/button";
import type { Route } from "./+types/home";
import { useAuth } from "@workos-inc/authkit-react";

export default function Home({}: Route.ComponentProps) {
  const { signIn, signUp, user } = useAuth();

  if (user) {
    return (
      <div className="flex items-center justify-center h-screen gap-8 w-full">
        <h1>Welcome, {user.firstName}!</h1>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen gap-8 w-full">
      <Button onClick={() => signIn()}>Sign In</Button>
      <Button onClick={() => signUp()}>Sign Up</Button>
    </div>
  );
}
