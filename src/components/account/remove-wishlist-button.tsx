"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { toggleWishlistAction } from "@/app/actions/cart-actions";
import { useCart } from "@/components/cart/cart-provider";

/**
 * Removes a saved item. The toggle runs server-side, and `refresh()` re-reads
 * the route so the list can never show a removal the database did not accept.
 */
export function RemoveWishlistButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  const { refresh } = useCart();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleWishlistAction(productId);
          if (!result.ok) {
            toast.error("Could not update your wishlist", {
              description: result.message,
            });
            return;
          }
          toast.success("Removed from your wishlist");
          await refresh();
        })
      }
      className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-xs font-medium text-ink hover:bg-surface-alt disabled:opacity-60"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
