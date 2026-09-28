import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { LoginForm } from "@/components/auth/auth-forms";
import { getCurrentUser } from "@/server/guards";
import { safeRedirect } from "@/lib/redirects";

/**
 * Sign-in.
 *
 * Already-authenticated visitors are sent to their account, so the form is only
 * ever shown when it is actually needed. `redirectTo` is only used as a
 * presentation hint here; the action re-validates it against a same-site
 * allowlist before using it.
 */

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Bikalpa Shoes account to track orders and manage your wishlist.",
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; callbackUrl?: string }>;
}) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  // Validated here as well as in the action: this redirect runs for a visitor who
  // already has a session, so a crafted `?callbackUrl=` would otherwise be a live
  // open redirect that never touches the sign-in form.
  const redirectTo = safeRedirect(query.redirectTo ?? query.callbackUrl, "/account");

  if (user) redirect(redirectTo);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-16 sm:py-24">
      <div className="text-center">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <Lock className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold text-ink">Welcome back</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Sign in to track orders, save your wishlist and check out faster.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <LoginForm redirectTo={redirectTo} />
      </div>

      <p className="mt-6 text-center text-xs text-ink-faint">
        You can also{" "}
        <Link href="/shop" className="underline underline-offset-2 hover:text-ink-soft">
          keep shopping as a guest
        </Link>{" "}
        — your bag is kept on this device.
      </p>
    </main>
  );
}
