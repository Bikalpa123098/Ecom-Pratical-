"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addToCartAction,
  clearCartAction,
  removeCartItemAction,
  updateCartItemAction,
} from "@/app/actions/cart-actions";

/**
 * Client cart state.
 *
 * The cart itself lives in MongoDB (guest carts are keyed by an httpOnly
 * cookie). This provider only mirrors the item count for instant feedback, and
 * every mutation goes through a server action that re-derives all money from
 * the database before returning. The server response is authoritative, so a
 * tampered client never sets a price.
 */

interface CartContextValue {
  itemCount: number;
  drawerOpen: boolean;
  openDrawer(): void;
  closeDrawer(): void;
  pending: boolean;
  /** Re-reads the cart from the server and updates every mirror of it. */
  refresh(): Promise<void>;
  add(input: { productId: string; size: string; quantity: number }): Promise<boolean>;
  setQuantity(itemId: string, quantity: number): Promise<void>;
  remove(itemId: string): Promise<void>;
  clear(): Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  initialItemCount,
  children,
}: {
  initialItemCount: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [itemCount, setItemCount] = useState(initialItemCount);
  const [syncedCount, setSyncedCount] = useState(initialItemCount);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // The layout re-reads the cart on every server render and hands us a fresh
  // count (after a router.refresh(), or a mutation somewhere else). Adopting it
  // during render rather than in an effect keeps the header badge in step with
  // the database without a cascading second render pass, and without painting
  // a stale count first.
  if (syncedCount !== initialItemCount) {
    setSyncedCount(initialItemCount);
    setItemCount(initialItemCount);
  }

  const refresh = useCallback<CartContextValue["refresh"]>(async () => {
    router.refresh();
  }, [router]);

  const add = useCallback<CartContextValue["add"]>(
    async (input) => {
      const result = await addToCartAction(input);
      if (!result.ok) {
        toast.error("Could not add to bag", { description: result.message });
        return false;
      }
      startTransition(() => {
        setItemCount(result.data?.itemCount ?? initialItemCount);
      });
      toast.success("Added to your bag", {
        description: input.size ? `Size EU ${input.size}` : undefined,
      });
      setDrawerOpen(true);
      return true;
    },
    [initialItemCount],
  );

  const setQuantity = useCallback<CartContextValue["setQuantity"]>(
    async (itemId, quantity) => {
      const result = await updateCartItemAction({ itemId, quantity });
      if (!result.ok) {
        toast.error("Could not update item", { description: result.message });
        return;
      }
      startTransition(() => {
        setItemCount(result.data?.itemCount ?? itemCount);
      });
    },
    [itemCount],
  );

  const remove = useCallback<CartContextValue["remove"]>(async (itemId) => {
    const result = await removeCartItemAction(itemId);
    if (!result.ok) {
      toast.error("Could not remove item", { description: result.message });
      return;
    }
    startTransition(() => {
      setItemCount(result.data?.itemCount ?? 0);
    });
    toast.success("Removed from your bag");
  }, []);

  const clear = useCallback<CartContextValue["clear"]>(async () => {
    const result = await clearCartAction();
    if (!result.ok) {
      toast.error("Could not empty bag", { description: result.message });
      return;
    }
    startTransition(() => setItemCount(0));
    toast.success("Your bag is empty");
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      itemCount,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      pending,
      refresh,
      add,
      setQuantity,
      remove,
      clear,
    }),
    [itemCount, drawerOpen, pending, refresh, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
