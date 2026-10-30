import { connection } from "next/server";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/Card";

// SPEC §17: the privacy page, in plain language.
export const instant = false;

export default async function PrivacyPage() {
  await connection();
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
        <Card className="space-y-5 p-6 text-sm leading-relaxed sm:p-8">
          <section className="space-y-2">
            <h2 className="text-base font-semibold">What is stored</h2>
            <p className="text-muted">Your username, a hashed password, your specs, and a session cookie. No email address is collected.</p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold">Where your text goes</h2>
            <p className="text-muted">
              Prompts and answers are sent to third-party AI providers (Groq, Google, OpenRouter). Free tiers may use data to improve their models.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold">What not to enter</h2>
            <p className="text-muted">Do not enter confidential information.</p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold">No email and no password reset</h2>
            <p className="text-muted">
              Nothing is sent by email, and there is no password reset. If you forget your password, the account and its specs cannot be recovered.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold">Deleting your account</h2>
            <p className="text-muted">
              Choose Delete my account in the account menu. It removes your specs, usage counts, sessions and account. Guest specs in your browser are not affected.
            </p>
          </section>
          <p>
            <Link href="/" className="text-accent underline-offset-4 hover:underline">
              Back to home
            </Link>
          </p>
        </Card>
      </main>
    </>
  );
}
