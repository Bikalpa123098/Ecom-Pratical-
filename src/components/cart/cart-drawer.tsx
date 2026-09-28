"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, ShoppingBag, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { formatNPR } from "@/lib/constants";
import { useCart } from "@/components/cart/cart-provider";
import { CartLines } from "@/components/cart/cart-lines";
import { getCartAction } from "@/app/actions/cart-actions";
import type { CartView } from "@/server/services/cart";

/**
 * Slide-in bag.
 *
 * Mounted once in the root layout. Lines are fetched from the server when the
 * drawer opens rather than mirrored, so the totals shown here are always the ones
 * the server just computed — the same numbers `/cart` and checkout will use.
 *
 * It is deliberately not rendered for reduced-motion users as a sliding panel;
 * the animation is a translate, and `animate-drawer-in` is disabled in CSS.
 */
/**
 * The free-delivery figures are passed in as props rather than imported.
 *
 * `@/lib/env` is server-only (it holds the eSewa signing secret and the database
 * URL), so a client component cannot read the delivery configuration directly.
 * The root layout reads it once on the server and hands the derived numbers down,
 * which also means the banner, the header and checkout all quote one value.
 */
export function CartDrawer({
  freeDeliveryThresholdPaisa,
  freeDeliveryEnabled,
}: {
  freeDeliveryThresholdPaisa: number;
  freeDeliveryEnabled: boolean;
}) {
  const { drawerOpen, closeDrawer, itemCount, pending } = useCart();
  const pathname = usePathname();
  const [view, setView] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setView(await getCartAction());
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on open, and again after a navigation (which may have emptied or
  // refilled the cart). The fetch is deferred out of the commit phase so React
  // finishes painting the open panel before the loading flag flips, rather than
  // re-rendering synchronously from inside the effect.
  useEffect(() => {
    if (!drawerOpen) return;
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [drawerOpen, load, pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;

  const lines = view?.lines ?? [];
  const subtotal = view?.subtotal ?? 0;
  /** Rupees still needed to qualify for free Valley delivery. */
  const freeDeliveryGap = freeDeliveryEnabled
    ? Math.ceil(Math.max(0, freeDeliveryThresholdPaisa - subtotal))
    : 0;

  return (
    <div className="fixed inset-0 z-90" role="dialog" aria-modal="true" aria-label="Your bag">
      <button
        type="button"
        aria-label="Close bag"
        onClick={closeDrawer}
        className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />

      <div className="animate-drawer-in absolute inset-y-0 right-0 flex w-[92%] max-w-md flex-col bg-paper shadow-lift">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <ShoppingBag className="h-4 w-4" aria-hidden />
            Your bag
            {itemCount > 0 ? (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                {itemCount}
              </span>
            ) : null}
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close bag"
            className="rounded-lg p-2 text-ink-soft hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && !view ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-ink-faint" aria-label="Loading your bag" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5">
            <CartLines lines={lines} compact />
          </div>
        )}

        {lines.length > 0 ? (
          <div className="space-y-3 border-t border-line bg-surface px-5 py-4">
            <dl className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd className="font-semibold text-ink">{formatNPR(subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-soft">Delivery</dt>
                <dd className="text-ink-faint">Calculated at checkout</dd>
              </div>
              {view?.savings ? (
                <div className="flex items-center justify-between text-success-700">
                  <dt>You save</dt>
                  <dd className="font-medium">{formatNPR(view.savings)}</dd>
                </div>
              ) : null}
            </dl>

            {freeDeliveryEnabled && freeDeliveryGap > 0 ? (
              <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
                Add {formatNPR(freeDeliveryGap)} more for free delivery inside Kathmandu Valley.
              </p>
            ) : null}

            <ButtonLink href="/checkout" size="lg" full onClick={closeDrawer}>
              Checkout
            </ButtonLink>
            <ButtonLink href="/cart" variant="ghost" size="sm" full onClick={closeDrawer}>
              View full bag
            </ButtonLink>
            {pending ? (
              <p className="text-center text-xs text-ink-faint">Saving your changes…</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
