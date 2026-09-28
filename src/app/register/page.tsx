import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { RegisterForm } from "@/components/auth/auth-forms";
import { getCurrentUser } from "@/server/guards";
import { safeRedirect } from "@/lib/redirects";

/**
 * Registration.
 *
 * A new account is always a CUSTOMER: `role` is not part of the sign-up payload
 * and better-auth marks it `input: false`, so it cannot be set by a crafted
 * request. Administrators are promoted server-side only.
 */

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a Bikalpa Shoes account to track orders and save your favourite pairs.",
  robots: { index: false, follow: true },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; callbackUrl?: string }>;
}) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  // Same rule as the sign-in page: an already-authenticated visitor must not be
  // redirected off-site by a crafted query string.
  const redirectTo = safeRedirect(query.redirectTo ?? query.callbackUrl, "/account");

  if (user) redirect(redirectTo);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-16 sm:py-24">
      <div className="text-center">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <UserPlus className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          It takes a moment, and your wishlist comes with you.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <RegisterForm redirectTo={redirectTo} />
      </div>
    </main>
  );
}
