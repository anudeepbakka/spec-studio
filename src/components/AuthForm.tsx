"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FIELD_CLASS } from "@/components/ui/Field";
import { passwordProblem, usernameProblem } from "@/lib/auth/rules";

// SPEC §11 screen 6 and §17: one form for sign-in and sign-up. Sign-up shows the no-reset warning and needs an
// acknowledgement before it submits. Errors are shown in plain words, and sign-in never says which part was wrong.
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === "sign-up";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setUsernameError(null);
    setPasswordError(null);

    if (isSignUp) {
      const userProblem = usernameProblem(username);
      const passProblem = passwordProblem(password);
      if (userProblem) setUsernameError(userProblem);
      if (passProblem) setPasswordError(passProblem);
      if (userProblem || passProblem) return;
      if (!acknowledged) {
        setFormError("Tick the box to confirm you understand there is no password reset.");
        return;
      }
    }

    setBusy(true);
    const path = isSignUp ? "/api/auth/sign-up/email" : "/api/auth/sign-in/username";
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (response.ok) {
      router.replace("/");
      router.refresh();
      return;
    }

    const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    const message = body?.error?.message ?? "Something went wrong. Please try again.";
    if (body?.error?.code === "username_taken") {
      setUsernameError(message);
    } else {
      setFormError(message);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="username" className="block text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          aria-invalid={usernameError ? true : undefined}
          aria-describedby={usernameError ? "username-error" : isSignUp ? "username-hint" : undefined}
          className={FIELD_CLASS}
        />
        {isSignUp && !usernameError ? (
          <p id="username-hint" className="text-xs text-muted">
            3 to 24 characters: letters, digits and underscore.
          </p>
        ) : null}
        {usernameError ? (
          <p id="username-error" className="text-xs text-danger">
            {usernameError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? "password-error" : isSignUp ? "password-hint" : undefined}
            className={`${FIELD_CLASS} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-2 my-auto grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-glass-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        </div>
        {isSignUp && !passwordError ? (
          <p id="password-hint" className="text-xs text-muted">
            At least 10 characters.
          </p>
        ) : null}
        {passwordError ? (
          <p id="password-error" className="text-xs text-danger">
            {passwordError}
          </p>
        ) : null}
      </div>

      {isSignUp ? (
        <div className="space-y-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm text-text">
            Spec Studio sends no email and has no password reset. If you forget your password, your account and its specs cannot be recovered.
          </p>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 accent-accent"
              required
            />
            <span>I understand there is no password reset.</span>
          </label>
        </div>
      ) : null}

      {formError ? (
        <p role="alert" aria-live="assertive" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={busy} className="w-full">
        <LogIn size={16} aria-hidden="true" />
        {busy ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
      </Button>

      <div className="flex flex-col gap-2 text-center text-sm text-muted sm:flex-row sm:justify-between">
        <Link href="/" className="rounded-md underline-offset-4 hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          Continue as guest
        </Link>
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="rounded-md underline-offset-4 hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
        </Link>
      </div>
    </form>
  );
}
