"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { adjustStockAction, type AdminState } from "@/app/actions/admin-actions";

/**
 * Sets the stock for one size of a product.
 *
 * The action takes the absolute stock for that size rather than a delta, so
 * two admins adjusting the same product cannot quietly overwrite each other.
 */
export function StockAdjustForm({
  productId,
  totalStock,
}: {
  productId: string;
  totalStock: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<AdminState, FormData>(adjustStockAction, { ok: false });

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-xs text-muted hover:text-ink hover:underline"
      >
        {open ? "Close" : "Set stock"}
      </button>

      {open ? (
        <form action={action} className="mt-2 space-y-2">
          <input type="hidden" name="productId" value={productId} />

          <div className="flex gap-2">
            <label className="sr-only" htmlFor={`size-${productId}`}>
              Size
            </label>
            <input
              id={`size-${productId}`}
              name="size"
              placeholder="40"
              required
              className="h-9 w-16 rounded-lg border border-line bg-surface px-2 text-xs outline-none focus:border-brand-500"
            />
            <label className="sr-only" htmlFor={`stock-${productId}`}>
              Stock
            </label>
            <input
              id={`stock-${productId}`}
              name="stock"
              type="number"
              min={0}
              max={100000}
              placeholder="0"
              required
              defaultValue={totalStock}
              className="h-9 w-20 rounded-lg border border-line bg-surface px-2 text-xs outline-none focus:border-brand-500"
            />
            <StockSubmit />
          </div>

          <p className="text-[11px] text-muted">
            Total stock across all sizes is currently {totalStock}.
          </p>

          {state && !state.ok ? (
            <p role="alert" className="text-[11px] text-red-700">
              {state.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

function StockSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 rounded-lg bg-ink px-3 text-xs font-semibold text-paper hover:bg-ink-soft disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}
