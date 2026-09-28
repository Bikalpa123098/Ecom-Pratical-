import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { effectivePrice, PAISA, GUEST_CART_COOKIE } from "@/lib/constants";

/**
 * Server-authoritative cart.
 *
 * Design rules:
 *  - A cart is owned by EITHER a signed-in user or an anonymous guest cookie.
 *  - Every read recomputes money from the Product table. Cached totals are never
 *    trusted, so a tampered cookie or a stale price cannot change a total.
 *  - The guest token is an httpOnly, sameSite=lax cookie holding a random id.
 *
 * Cookie rules (important): reads must never write a cookie. Next.js forbids
 * `cookies().set()` while a Server Component is rendering, and the root layout
 * reads the cart on every page. The token is therefore minted in middleware
 * (see `src/middleware.ts`), so by the time any read runs the cookie already
 * exists. Only explicit mutations inside a Server Action may set it.
 */

const GUEST_TOKEN_BYTES = 24;

/** Inventory above which we warn but still allow ordering. */
const LOW_STOCK_THRESHOLD = 3;

export interface CartLine {
  itemId: string;
  productId: string;
  name: string;
  slug: string;
  sku: string;
  image: string | null;
  size: string;
  quantity: number;
  /** paisa */
  unitPrice: number;
  /** paisa, the pre-discount MRP */
  unitMrp: number;
  /** paisa */
  lineTotal: number;
  availableStock: number;
  inStock: boolean;
  lowStock: boolean;
  maxQuantity: number;
  brandName: string;
  categoryName: string;
  removed: boolean;
  removalReason: string | null;
}

export interface CartView {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  savings: number;
  hasUnavailable: boolean;
  isGuest: boolean;
}

function randomToken(): string {
  const bytes = new Uint8Array(GUEST_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Detects a MongoDB duplicate-key (E11000) unique constraint violation. */
function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === 11000 || code === "P2002";
}

const GUEST_TOKEN_RE = /^[a-f0-9]{16,64}$/;

/**
 * Reads the guest cart token without ever writing a cookie.
 * Returns null when the visitor has no token (e.g. a crawler's very first hit
 * before middleware has had a chance to respond).
 */
export async function readGuestCartToken(): Promise<string | null> {
  const existing = (await cookies()).get(GUEST_CART_COOKIE)?.value;
  return existing && GUEST_TOKEN_RE.test(existing) ? existing : null;
}

/**
 * Returns the guest token, minting and setting it if absent.
 * Only legal inside a Server Action or Route Handler.
 */
async function requireGuestCartToken(): Promise<string> {
  const existing = await readGuestCartToken();
  if (existing) return existing;

  const token = randomToken();
  const jar = await cookies();
  jar.set(GUEST_CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return token;
}

/** A cart that exists only in memory, for a visitor with no token yet. */
function emptyCartView(): CartView {
  return {
    lines: [],
    itemCount: 0,
    subtotal: 0,
    savings: 0,
    hasUnavailable: false,
    isGuest: true,
  };
}

/**
 * Finds (or creates) the cart row for the caller.
 *
 * `create` is false on read paths: a visitor with no token gets a transient
 * empty cart rather than a database write plus a cookie mutation.
 */
async function resolveCart(
  userId: string | null,
  create: boolean
): Promise<{ kind: "row"; cart: { id: string } } | { kind: "transient" }> {
  if (userId) {
    const existing = await prisma.cart.findUnique({ where: { userId } });
    if (existing) return { kind: "row", cart: existing };
    if (!create) return { kind: "transient" };
    return { kind: "row", cart: await prisma.cart.create({ data: { userId } }) };
  }

  // Guests: a token is minted only on a mutating path.
  const guestToken = create ? await requireGuestCartToken() : await readGuestCartToken();
  if (!guestToken) return { kind: "transient" };

  const existing = await prisma.cart.findUnique({ where: { guestToken } });
  if (existing) return { kind: "row", cart: existing };
  if (!create) return { kind: "transient" };

  // A unique constraint violation means a concurrent request already created a
  // cart with this token (e.g. mergeGuestCartIntoUser running during login).
  // Re-read instead of failing the user's "Add to bag" click.
  try {
    return { kind: "row", cart: await prisma.cart.create({ data: { guestToken } }) };
  } catch (err) {
    if (isUniqueViolation(err)) {
      const racing = await prisma.cart.findUnique({ where: { guestToken } });
      if (racing) return { kind: "row", cart: racing };
    }
    throw err;
  }
}

/**
 * When a guest signs in, merge their guest cart into their user cart so nothing
 * is lost at the login boundary.
 */
export async function mergeGuestCartIntoUser(
  guestToken: string,
  userId: string
): Promise<void> {
  if (!guestToken) return;
  const guestCart = await prisma.cart.findUnique({
    where: { guestToken },
    include: { items: true },
  });
  if (!guestCart || guestCart.items.length === 0) {
    await prisma.cart.deleteMany({ where: { guestToken } });
    return;
  }

  // Clean up any orphaned cart rows with this guestToken (e.g. from a previous
  // failed merge attempt) to avoid unique constraint violations on re-login.
  await prisma.cart.deleteMany({ where: { guestToken } });

  const resolved = await resolveCart(userId, true);
  if (resolved.kind !== "row") return;
  const userCart = resolved.cart;

  for (const item of guestCart.items) {
    const existing = await prisma.cartItem.findUnique({
      where: {
        cartId_productId_size: {
          cartId: userCart.id,
          productId: item.productId,
          size: item.size,
        },
      },
    });
    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: Math.min(existing.quantity + item.quantity, 20) },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: userCart.id,
          productId: item.productId,
          size: item.size,
          quantity: item.quantity,
        },
      });
    }
  }

  await prisma.cart.deleteMany({ where: { id: guestCart.id } });
}

export async function getCartView(userId: string | null): Promise<CartView> {
  // A read must not create rows or cookies, so a visitor with no token yet
  // simply sees an empty bag until middleware sets the cookie.
  const resolved = await resolveCart(userId, false);
  if (resolved.kind !== "row") return emptyCartView();
  const cart = resolved.cart;

  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        include: {
          brand: { select: { name: true } },
          category: { select: { name: true } },
          sizes: { select: { size: true, stock: true, isActive: true } },
        },
      },
    },
  });

  const lines: CartLine[] = items.map((item) => {
    const product = item.product;
    const sizeRow = product.sizes.find((s) => s.size === item.size);
    const availableStock = sizeRow?.isActive ? sizeRow.stock : 0;
    const unitMrp = product.price;
    const unitPrice = effectivePrice(product.price, product.discountPrice);

    // A line is flagged rather than silently dropped so the shopper is told
    // why their total changed instead of finding out at checkout.
    let removed = false;
    let removalReason: string | null = null;
    if (product.status !== "ACTIVE") {
      removed = true;
      removalReason = "This product is no longer available.";
    } else if (!sizeRow || !sizeRow.isActive) {
      removed = true;
      removalReason = `Size ${item.size} is no longer offered.`;
    } else if (availableStock === 0) {
      removed = true;
      removalReason = `Size ${item.size} is out of stock.`;
    } else if (item.quantity > availableStock) {
      removed = true;
      removalReason = `Only ${availableStock} left in size ${item.size}.`;
    }

    const effectiveQty = removed ? 0 : item.quantity;

    return {
      itemId: item.id,
      productId: item.productId,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      image: product.images[0] ?? null,
      size: item.size,
      quantity: item.quantity,
      unitPrice,
      unitMrp,
      lineTotal: unitPrice * effectiveQty,
      availableStock,
      inStock: !removed,
      lowStock: !removed && availableStock <= LOW_STOCK_THRESHOLD,
      maxQuantity: Math.min(availableStock, 20),
      brandName: product.brand.name,
      categoryName: product.category.name,
      removed,
      removalReason,
    };
  });

  const active = lines.filter((l) => !l.removed);
  const subtotal = active.reduce((sum, l) => sum + l.lineTotal, 0);
  const savings = active.reduce(
    (sum, l) => sum + Math.max(0, l.unitMrp - l.unitPrice) * l.quantity,
    0
  );

  return {
    lines,
    itemCount: active.reduce((sum, l) => sum + l.quantity, 0),
    subtotal,
    savings,
    hasUnavailable: lines.some((l) => l.removed),
    isGuest: !userId,
  };
}

export async function getCartItemCount(userId: string | null): Promise<number> {
  const view = await getCartView(userId);
  return view.itemCount;
}

export class CartError extends Error {
  override name = "CartError";
  constructor(message: string) {
    super(message);
  }
}

/** Adds a line, refusing to exceed real stock. */
export async function addToCart(
  userId: string | null,
  input: { productId: string; size: string; quantity: number }
): Promise<CartView> {
  const resolved = await resolveCart(userId, true);
  if (resolved.kind !== "row") return emptyCartView();
  const cart = resolved.cart;

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    include: { sizes: true },
  });
  if (!product || product.status !== "ACTIVE") {
    throw new CartError("This product is no longer available.");
  }

  const sizeRow = product.sizes.find((s) => s.size === input.size);
  if (!sizeRow || !sizeRow.isActive) {
    throw new CartError(`Size ${input.size} is not available for this product.`);
  }
  if (sizeRow.stock <= 0) {
    throw new CartError(`Size ${input.size} is out of stock.`);
  }

  const existing = await prisma.cartItem.findUnique({
    where: {
      cartId_productId_size: {
        cartId: cart.id,
        productId: input.productId,
        size: input.size,
      },
    },
  });

  const desired = (existing?.quantity ?? 0) + input.quantity;
  const capped = Math.min(desired, sizeRow.stock, 20);
  if (capped < desired) {
    throw new CartError(
      `Only ${Math.min(sizeRow.stock, 20)} available in size ${input.size}.`
    );
  }

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: capped },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: input.productId,
        size: input.size,
        quantity: capped,
      },
    });
  }

  return getCartView(userId);
}

export async function updateCartItemQuantity(
  userId: string | null,
  input: { itemId: string; quantity: number }
): Promise<CartView> {
  const resolved = await resolveCart(userId, true);
  if (resolved.kind !== "row") return emptyCartView();
  const cart = resolved.cart;

  // Scoped to this cart so one user cannot mutate another's line by guessing an id.
  const item = await prisma.cartItem.findFirst({
    where: { id: input.itemId, cartId: cart.id },
    include: { product: { include: { sizes: true } } },
  });
  if (!item) throw new CartError("That item is no longer in your bag.");

  const sizeRow = item.product.sizes.find((s) => s.size === item.size);
  if (!sizeRow || !sizeRow.isActive || sizeRow.stock <= 0) {
    throw new CartError(`Size ${item.size} is no longer available.`);
  }
  if (input.quantity > Math.min(sizeRow.stock, 20)) {
    throw new CartError(
      `Only ${Math.min(sizeRow.stock, 20)} available in size ${item.size}.`
    );
  }

  await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: input.quantity },
  });
  return getCartView(userId);
}

export async function removeCartItem(
  userId: string | null,
  itemId: string
): Promise<CartView> {
  const resolved = await resolveCart(userId, true);
  if (resolved.kind !== "row") return emptyCartView();
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: resolved.cart.id } });
  return getCartView(userId);
}

export async function clearCart(userId: string | null): Promise<CartView> {
  const resolved = await resolveCart(userId, true);
  if (resolved.kind !== "row") return emptyCartView();
  await prisma.cartItem.deleteMany({ where: { cartId: resolved.cart.id } });
  return getCartView(userId);
}

/** Re-validates every line against live stock, trimming what cannot be sold. */
export async function reconcileCart(userId: string | null): Promise<CartView> {
  const view = await getCartView(userId);
  for (const line of view.lines) {
    if (line.removed) await removeCartItem(userId, line.itemId);
  }
  return getCartView(userId);
}

export { GUEST_CART_COOKIE, PAISA };
