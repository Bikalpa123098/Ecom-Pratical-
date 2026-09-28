"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, TextInput } from "@/components/ui/form";
import {
  loginAction,
  registerAction,
  type AuthState,
} from "@/app/actions/auth-actions";
import { PASSWORD_RULE_TEXT } from "@/lib/schemas";

/**
 * Sign-in and sign-up forms.
 *
 * Both submit through `useActionState` so validation and credentials are checked
 * on the server. The only client-side work is toggling password visibility and
 * following the redirect the action returns; no decision is made in the browser.
 */

const initial: AuthState = { ok: false };

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (state.ok && state.redirectTo) router.replace(state.redirectTo);
  }, [state, router]);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
      <FormError message={state.message} />

      <Field label="Email address" htmlFor="email" error={state.errors?.email} required>
        <TextInput
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          invalid={Boolean(state.errors?.email)}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={state.errors?.password}
        required
        className="relative"
      >
        <TextInput
          id="password"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Your password"
          required
          invalid={Boolean(state.errors?.password)}
          className="pr-11"
        />
        <PasswordToggle shown={show} onToggle={() => setShow((s) => !s)} />
      </Field>

      <Button type="submit" size="lg" full disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-ink-soft">
        New to Bikalpa?{" "}
        <Link
          href={redirectTo ? `/register?redirectTo=${encodeURIComponent(redirectTo)}` : "/register"}
          className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action, pending] = useActionState(registerAction, initial);
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (state.ok && state.redirectTo) router.replace(state.redirectTo);
  }, [state, router]);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
      <FormError message={state.message} />

      <Field label="Full name" htmlFor="name" error={state.errors?.name} required>
        <TextInput
          id="name"
          name="name"
          autoComplete="name"
          placeholder="Asha Gurung"
          required
          invalid={Boolean(state.errors?.name)}
        />
      </Field>

      <Field label="Email address" htmlFor="email" error={state.errors?.email} required>
        <TextInput
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          invalid={Boolean(state.errors?.email)}
        />
      </Field>

      <Field
        label="Mobile number"
        htmlFor="phone"
        error={state.errors?.phone}
        hint="Used only for delivery updates."
        required
      >
        <TextInput
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="98XXXXXXXX"
          pattern="9[678][0-9]{8}"
          required
          invalid={Boolean(state.errors?.phone)}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={state.errors?.password}
        hint={PASSWORD_RULE_TEXT}
        required
      >
        <TextInput
          id="password"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          invalid={Boolean(state.errors?.password)}
          className="pr-11"
        />
        <PasswordToggle shown={show} onToggle={() => setShow((s) => !s)} />
      </Field>

      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        error={state.errors?.confirmPassword}
        required
      >
        <TextInput
          id="confirmPassword"
          name="confirmPassword"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          invalid={Boolean(state.errors?.confirmPassword)}
          className="pr-11"
        />
      </Field>

      <Checkbox
        id="terms"
        name="terms"
        required
        label={
          <>
            I agree to Bikalpa&apos;s{" "}
            <Link href="/terms" className="underline underline-offset-2">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              privacy policy
            </Link>
            .
          </>
        }
      />

      <Button type="submit" size="lg" full disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link
          href={redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/login"}
          className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink-faint transition-colors hover:text-ink"
    >
      {shown ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
    </button>
  );
}
