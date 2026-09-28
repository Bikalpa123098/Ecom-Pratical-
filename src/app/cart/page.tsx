import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/server/guards";
import { getCartView } from "@/server/services/cart";
import { formatNPR } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/button";
import { CartLines, ClearBagButton } from "@/components/cart/cart-lines";
import {
  freeDeliveryThresholdPaisa,
  isFreeDeliveryEnabled,
} from "@/lib/store-config";
import { Truck, Wallet, RotateCcw } from "lucide-react";

/**
 * The bag.
 *
 * Reads the same `CartView` the drawer does, so a customer who lands here
 * directly (or on a shared device) sees exactly what checkout will compute.
 * Nothing here is cached: the cart is per-visitor and lives in MongoDB.
 */

export const metadata: Metadata = {
  title: "Your bag",
  description: "Review the items in your Bikalpa Shoes bag before checkout.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const user = await getCurrentUser();
  const view = await getCartView(user?.id ?? null);

  const gap = isFreeDeliveryEnabled
    ? Math.ceil(Math.max(0, freeDeliveryThresholdPaisa - view.subtotal))
    : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Your bag</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {view.itemCount === 0
              ? "Nothing here yet."
              : `${view.itemCount} ${view.itemCount === 1 ? "item" : "items"} ready to go.`}
          </p>
        </div>
        {view.lines.length > 0 ? <ClearBagButton /> : null}
      </header>

      {view.lines.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-surface px-6 py-16 text-center">
          <p className="text-ink-soft">Your bag is empty.</p>
          <ButtonLink href="/shop" size="lg" className="mt-6">
            Start shopping
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
          <div>
            {view.hasUnavailable ? (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-800"
              >
                Some items in your bag are no longer available in the quantity requested. Please
                adjust them before checking out.
              </div>
            ) : null}
            <CartLines lines={view.lines} />
          </div>

          <aside className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
              <h2 className="font-display text-lg font-semibold text-ink">Order summary</h2>

              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-ink-soft">Subtotal</dt>
                  <dd className="font-medium text-ink">{formatNPR(view.subtotal)}</dd>
                </div>
                {view.savings > 0 ? (
                  <div className="flex items-center justify-between text-success-700">
                    <dt>Discount</dt>
                    <dd className="font-medium">−{formatNPR(view.savings)}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <dt className="text-ink-soft">Delivery</dt>
                  <dd className="text-ink-faint">Calculated at checkout</dd>
                </div>
              </dl>

              <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
                <span className="text-sm font-medium text-ink">Estimated total</span>
                <span className="font-display text-xl font-semibold text-ink">
                  {formatNPR(view.subtotal)}
                </span>
              </div>
              <p className="mt-1 text-right text-xs text-ink-faint">
                before delivery and any tax
              </p>

              {isFreeDeliveryEnabled && gap > 0 ? (
                <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2.5 text-xs text-brand-800">
                  Add {formatNPR(gap)} more to get free delivery inside Kathmandu Valley.
                </p>
              ) : null}
              {isFreeDeliveryEnabled && gap === 0 && view.subtotal > 0 ? (
                <p className="mt-4 rounded-lg bg-success-50 px-3 py-2.5 text-xs text-success-800">
                  Your order qualifies for free delivery inside Kathmandu Valley.
                </p>
              ) : null}

              <ButtonLink
                href="/checkout"
                size="lg"
                full
                className="mt-5"
              >
                Proceed to checkout
              </ButtonLink>

              <p className="mt-3 text-center text-xs text-ink-faint">
                You can also{" "}
                <Link href="/shop" className="underline underline-offset-2 hover:text-ink-soft">
                  keep shopping
                </Link>
                .
              </p>
            </div>

            <ul className="mt-5 space-y-3 text-sm text-ink-soft">
              <li className="flex gap-2.5">
                <Wallet className="h-4 w-4 shrink-0 text-brand-700" aria-hidden />
                <span>Pay with eSewa or cash on delivery.</span>
              </li>
              <li className="flex gap-2.5">
                <Truck className="h-4 w-4 shrink-0 text-brand-700" aria-hidden />
                <span>
                  1–3 working days in the Valley, 3–7 days elsewhere in Nepal.
                </span>
              </li>
              <li className="flex gap-2.5">
                <RotateCcw className="h-4 w-4 shrink-0 text-brand-700" aria-hidden />
                <span>7-day exchange on size issues.</span>
              </li>
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
