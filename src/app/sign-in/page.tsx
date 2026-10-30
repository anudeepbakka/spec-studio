import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AuthForm } from "@/components/AuthForm";
import { Card } from "@/components/ui/Card";
import { currentUser } from "@/lib/auth/identity";

// SPEC §11 screen 6: a card with username and password. Signed-in users go straight to the home page.
export const instant = false;

export default async function SignInPage() {
  await connection();
  if (await currentUser()) redirect("/");
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md px-4 py-14 sm:px-6">
        <Card className="w-full space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted">Use your username and password. Your guest specs stay in this browser.</p>
          </div>
          <AuthForm mode="sign-in" />
        </Card>
      </main>
    </>
  );
}
