import "server-only";

import { prisma } from "@/lib/db";
import { effectivePrice } from "@/lib/constants";
import { assertUser } from "@/server/guards";

/**
 * Wishlist. Signed-in users only: there is no guest wishlist, so a wishlist
 * always has exactly one owner and the scoping rules stay trivial to audit.
 */

const itemInclude = {
  product: {
    include: {
      brand: { select: { name: true, slug: true } },
      category: { select: { name: true, slug: true } },
    },
  },
} as const;

async function resolveWishlist(userId: string) {
  const existing = await prisma.wishlist.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.wishlist.create({ data: { userId } });
}

export interface WishlistView {
  items: {
    id: string;
    productId: string;
    name: string;
    slug: string;
    price: number;
    discountPrice: number | null;
    unitMrp: number;
    image: string | null;
    inStock: boolean;
    brandName: string;
    createdAt: Date;
  }[];
  count: number;
}

export async function getWishlist(userId: string): Promise<WishlistView> {
  const wishlist = await resolveWishlist(userId);
  const rows = await prisma.wishlistItem.findMany({
    where: { wishlistId: wishlist.id },
    orderBy: { createdAt: "desc" },
    include: itemInclude,
  });

  const items = rows
    // A product removed from the catalogue should not break the wishlist page.
    .filter((r) => r.product.status === "ACTIVE")
    .map((r) => ({
      id: r.id,
      productId: r.productId,
      name: r.product.name,
      slug: r.product.slug,
      price: effectivePrice(r.product.price, r.product.discountPrice),
      discountPrice: r.product.discountPrice,
      unitMrp: r.product.price,
      image: r.product.images[0] ?? null,
      inStock: r.product.totalStock > 0,
      brandName: r.product.brand.name,
      createdAt: r.createdAt,
    }));

  return { items, count: items.length };
}

export async function getWishlistProductIds(userId: string): Promise<string[]> {
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId },
    include: { items: { select: { productId: true } } },
  });
  return wishlist?.items.map((i) => i.productId) ?? [];
}

export async function toggleWishlist(
  userId: string,
  productId: string
): Promise<{ added: boolean; count: number }> {
  const wishlist = await resolveWishlist(userId);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, status: true },
  });
  if (!product || product.status !== "ACTIVE") {
    throw new Error("This product is not available.");
  }

  const existing = await prisma.wishlistItem.findUnique({
    where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    const count = await prisma.wishlistItem.count({ where: { wishlistId: wishlist.id } });
    return { added: false, count };
  }

  await prisma.wishlistItem.create({ data: { wishlistId: wishlist.id, productId } });
  const count = await prisma.wishlistItem.count({ where: { wishlistId: wishlist.id } });
  return { added: true, count };
}

/** Convenience for actions that already resolved the user. */
export async function toggleWishlistForCurrentUser(
  productId: string
): Promise<{ added: boolean; count: number }> {
  const user = await assertUser();
  return toggleWishlist(user.id, productId);
}
