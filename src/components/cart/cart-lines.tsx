"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Minus, Plus, Trash2, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatNPR } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { useCart } from "@/components/cart/cart-provider";
import { removeCartItemAction, updateCartItemAction } from "@/app/actions/cart-actions";
import type { CartLine } from "@/server/services/cart";
import { toast } from "sonner";

/**
 * Cart line items, shared by the `/cart` page and the slide-in drawer.
 *
 * Quantities are sent as { itemId, quantity } and re-priced by the server, so a
 * client that edits the stepper beyond the allowed maximum is rejected rather
 * than trusted. The stepper disables itself at `maxQuantity`, which the service
 * derives from live stock.
 */

export function CartLines({
  lines,
  compact = false,
}: {
  lines: CartLine[];
  compact?: boolean;
}) {
  if (lines.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-ink-soft">Your bag is empty.</p>
        <ButtonLink href="/shop" variant="secondary" size="sm" className="mt-4">
          Browse the collection
        </ButtonLink>
      </div>
    );
  }

  return (
    <ul className={cn("divide-y divide-line", compact ? "" : "rounded-2xl border border-line bg-surface")}>
      {lines.map((line) => (
        <CartLineRow key={line.itemId} line={line} compact={compact} />
      ))}
    </ul>
  );
}

function CartLineRow({ line, compact }: { line: CartLine; compact: boolean }) {
  const { refresh } = useCart();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const working = pending || busy;

  function setQuantity(next: number) {
    if (next < 1 || next > line.maxQuantity || next === line.quantity) return;
    setBusy(true);
    startTransition(async () => {
      const result = await updateCartItemAction({ itemId: line.itemId, quantity: next });
      setBusy(false);
      if (!result.ok) {
        toast.error(result.message ?? "We could not update that item.");
      }
      await refresh();
    });
  }

  function remove() {
    setBusy(true);
    startTransition(async () => {
      const result = await removeCartItemAction(line.itemId);
      setBusy(false);
      if (!result.ok) toast.error(result.message ?? "We could not remove that item.");
      else toast.success("Removed from your bag.");
      await refresh();
    });
  }

  return (
    <li className={cn("flex gap-3.5", compact ? "py-4" : "p-4 sm:p-5")}>
      <Link
        href={`/products/${line.slug}`}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-paper sm:h-24 sm:w-24"
      >
        {line.image ? (
          <Image src={line.image} alt="" fill sizes="96px" className="object-contain p-1.5" />
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
              {line.brandName}
            </p>
            <Link
              href={`/products/${line.slug}`}
              className="mt-0.5 block truncate text-sm font-medium text-ink hover:underline"
            >
              {line.name}
            </Link>
            <p className="mt-0.5 text-xs text-ink-soft">
              Size {line.size}
              {line.unitMrp > line.unitPrice ? (
                <>
                  {" · "}
                  <span className="text-muted line-through">{formatNPR(line.unitMrp)}</span>
                </>
              ) : null}
            </p>
          </div>

          <button
            type="button"
            onClick={remove}
            disabled={working}
            aria-label={`Remove ${line.name} (size ${line.size}) from your bag`}
            className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-ink/5 hover:text-danger-600 disabled:opacity-50"
          >
            {working ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <X className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>

        {line.removed ? (
          <p className="mt-1.5 text-xs font-medium text-danger-600">
            {line.removalReason ?? "This item is no longer available."}
          </p>
        ) : !line.inStock ? (
          <p className="mt-1.5 text-xs font-medium text-danger-600">Out of stock</p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 pt-2.5">
          <div className="inline-flex items-center rounded-full border border-line-strong">
            <button
              type="button"
              onClick={() => setQuantity(line.quantity - 1)}
              disabled={working || line.quantity <= 1}
              aria-label="Decrease quantity"
              className="grid h-8 w-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden />
            </button>
            <span className="min-w-7 text-center text-sm font-medium text-ink tabular-nums">
              {line.quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(line.quantity + 1)}
              disabled={working || line.quantity >= line.maxQuantity}
              aria-label="Increase quantity"
              className="grid h-8 w-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          <div className="text-right">
            <p className="text-sm font-semibold text-ink">{formatNPR(line.lineTotal)}</p>
            {line.unitMrp > line.unitPrice ? (
              <p className="text-[11px] text-muted line-through">
                {formatNPR(line.unitMrp * line.quantity)}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

export function ClearBagButton() {
  const [busy, setBusy] = useState(false);
  const { clear } = useCart();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const { clearCartAction } = await import("@/app/actions/cart-actions");
        const result = await clearCartAction();
        setBusy(false);
        if (!result.ok) toast.error(result.message ?? "We could not empty your bag.");
        else toast.success("Your bag is empty.");
        await clear();
      }}
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
      Empty bag
    </Button>
  );
}
