"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/guards";
import {
  addToCart as addToCartSvc,
  CartError,
  clearCart as clearCartSvc,
  getCartView,
  removeCartItem as removeCartItemSvc,
  updateCartItemQuantity as updateCartItemQuantitySvc,
} from "@/server/services/cart";
import { toggleWishlist as toggleWishlistSvc } from "@/server/services/wishlist";
import { addToCartSchema, updateCartItemSchema } from "@/lib/schemas";
import { fieldErrorsFrom } from "@/server/validation";

/**
 * Cart and wishlist server actions.
 *
 * These are thin wrappers: they validate input, resolve the caller, delegate to
 * the service layer, and shape a serialisable result. All money is recomputed in
 * the service, never taken from the action arguments.
 */

export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: T;
}

function fail(message: string): ActionResult<never> {
  return { ok: false, message };
}

export async function addToCartAction(
  input: unknown
): Promise<ActionResult<{ itemCount: number }>> {
  const parsed = addToCartSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please check the details.", errors: fieldErrorsFrom(parsed.error) };
  }

  const user = await getCurrentUser();
  try {
    const view = await addToCartSvc(user?.id ?? null, parsed.data);
    revalidatePath("/cart");
    return {
      ok: true,
      data: { itemCount: view.itemCount },
      message: "Added to your bag.",
    };
  } catch (err) {
    if (err instanceof CartError) return fail(err.message);
    console.error("[cart] add failed", err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    return fail(`We could not add that to your bag. ${detail}`);
  }
}

export async function updateCartItemAction(
  input: unknown
): Promise<ActionResult<{ itemCount: number; subtotal: number }>> {
  const parsed = updateCartItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please check the details.", errors: fieldErrorsFrom(parsed.error) };
  }

  const user = await getCurrentUser();
  try {
    const view = await updateCartItemQuantitySvc(user?.id ?? null, parsed.data);
    revalidatePath("/cart");
    return { ok: true, data: { itemCount: view.itemCount, subtotal: view.subtotal } };
  } catch (err) {
    if (err instanceof CartError) return fail(err.message);
    console.error("[cart] update failed", err);
    return fail("We could not update that item.");
  }
}

export async function removeCartItemAction(
  itemId: string
): Promise<ActionResult<{ itemCount: number }>> {
  const parsed = z.string().trim().min(1).safeParse(itemId);
  if (!parsed.success) return fail("Invalid item.");

  const user = await getCurrentUser();
  try {
    await removeCartItemSvc(user?.id ?? null, parsed.data);
    revalidatePath("/cart");
    return { ok: true, data: { itemCount: await getCartView(user?.id ?? null).then((v) => v.itemCount) } };
  } catch (err) {
    if (err instanceof CartError) return fail(err.message);
    console.error("[cart] remove failed", err);
    return fail("We could not remove that item.");
  }
}

export async function clearCartAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  try {
    await clearCartSvc(user?.id ?? null);
    revalidatePath("/cart");
    return { ok: true };
  } catch (err) {
    console.error("[cart] clear failed", err);
    return fail("We could not empty your bag.");
  }
}

export async function toggleWishlistAction(
  productId: string
): Promise<ActionResult<{ added: boolean; count: number }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: "Please sign in to save items to your wishlist." };
  }

  const parsed = z.string().trim().min(1).safeParse(productId);
  if (!parsed.success) return fail("Invalid product.");

  try {
    const result = await toggleWishlistSvc(user.id, parsed.data);
    revalidatePath("/account/wishlist");
    return { ok: true, data: result };
  } catch (err) {
    console.error("[wishlist] toggle failed", err);
    return fail("We could not update your wishlist.");
  }
}

export async function getCartAction(): Promise<
  Awaited<ReturnType<typeof getCartView>>
> {
  const user = await getCurrentUser();
  return getCartView(user?.id ?? null);
}
