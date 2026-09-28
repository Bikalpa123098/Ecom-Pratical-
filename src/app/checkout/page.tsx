import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getCurrentUser } from "@/server/guards";
import { getCartView } from "@/server/services/cart";
import { CheckoutForm } from "@/components/checkout/checkout-form";

/**
 * Checkout.
 *
 * Guests can check out; the order is created against their `bkl_guest_order`
 * capability cookie so they can still reach the confirmation and result pages
 * without an account. Signed-in customers are offered to save the address.
 *
 * Redirects away when there is nothing to buy, so a refresh after a completed
 * order does not re-run the form.
 */

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Bikalpa Shoes order and pay securely with eSewa.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  const view = await getCartView(user?.id ?? null);

  if (view.lines.length === 0) redirect("/cart");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <Link href="/cart" className="text-sm text-ink-soft hover:text-ink hover:underline">
          ← Back to your bag
        </Link>
        <div className="mt-3 flex items-center gap-2.5">
          <Lock className="h-5 w-5 text-brand-700" aria-hidden />
          <h1 className="font-display text-3xl font-semibold text-ink">Checkout</h1>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {user ? (
            <>Checking out as {user.email}.</>
          ) : (
            <>
              Checking out as a guest.{" "}
              <Link href="/login?redirectTo=/checkout" className="underline underline-offset-2">
                Sign in
              </Link>{" "}
              to use a saved address.
            </>
          )}
        </p>
      </header>

      <CheckoutForm
        view={view}
        signedIn={Boolean(user)}
        defaults={{
          fullName: user?.name ?? "",
          email: user?.email ?? "",
          phone: (user?.phone as string | null | undefined) ?? "",
        }}
      />
    </div>
  );
}
