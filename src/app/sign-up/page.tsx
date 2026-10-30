import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AuthForm } from "@/components/AuthForm";
import { Card } from "@/components/ui/Card";
import { currentUser } from "@/lib/auth/identity";

// SPEC §11 screen 6: the sign-up card, with the no-reset warning and its acknowledgement. Signed-in users go to the home page.
export const instant = false;

export default async function SignUpPage() {
  await connection();
  if (await currentUser()) redirect("/");
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md px-4 py-14 sm:px-6">
        <Card className="w-full space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
            <p className="text-sm text-muted">Keep your specs across devices, and get a higher daily limit.</p>
          </div>
          <AuthForm mode="sign-up" />
        </Card>
      </main>
    </>
  );
}
