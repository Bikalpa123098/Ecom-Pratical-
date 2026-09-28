import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { effectivePrice, type ProductSort } from "@/lib/constants";
import type { ProductQuery } from "@/lib/schemas";

/**
 * Catalogue reads. Product prices are always resolved server-side; nothing here
 * trusts a price supplied by the client.
 */

export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  discountPrice: number | null;
  images: string[];
  gender: string;
  colorName: string | null;
  colorHex: string | null;
  totalStock: number;
  featured: boolean;
  status: string;
  createdAt: Date;
  brand: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string; kind: string };
  sizes: { size: string; stock: number; isActive: boolean }[];
}

const cardSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  price: true,
  discountPrice: true,
  images: true,
  gender: true,
  colorName: true,
  colorHex: true,
  totalStock: true,
  featured: true,
  status: true,
  createdAt: true,
  brand: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true, kind: true } },
  sizes: {
    select: { size: true, stock: true, isActive: true },
    orderBy: { size: "asc" as const },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

/**
 * The price a customer actually pays, in paisa. Mirrors `effectivePrice` but is
 * exported with the persistence concern attached: every write path that sets
 * `price` or `discountPrice` must also set `sortPrice` with this, or MongoDB
 * ordering and price filters drift away from what is charged.
 */
export function effectivePricePaisa(
  price: number,
  discountPrice: number | null | undefined
): number {
  return discountPrice && discountPrice > 0 && discountPrice < price ? discountPrice : price;
}

function toCard(row: CardRow): ProductCard {
  return {
    ...row,
    price: effectivePrice(row.price, row.discountPrice),
    // Keep the original MRP available to callers that need to show a discount.
    discountPrice: row.discountPrice,
  };
}

function orderByFor(sort: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }];
    case "price_asc":
      // `sortPrice` is the denormalised effective price, so this orders by what
      // the shopper actually pays. Sorting on `price`/`discountPrice` directly
      // would put every non-discounted product (null) ahead of the discounted
      // ones and mix the two scales.
      return [{ sortPrice: "asc" }, { name: "asc" }];
    case "price_desc":
      return [{ sortPrice: "desc" }, { name: "asc" }];
    case "name_asc":
      return [{ name: "asc" }];
    case "name_desc":
      return [{ name: "desc" }];
    case "popular":
      return [{ soldCount: "desc" }, { createdAt: "desc" }];
    case "rating":
      return [{ ratingAverage: "desc" }, { ratingCount: "desc" }];
    case "discount":
      // Deepest markdown first: the biggest gap between MRP and effective price.
      return [{ discountPrice: "asc" }, { price: "desc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }];
  }
}

/**
 * Escapes a user-supplied search term for use inside a regular expression.
 *
 * Prisma's `contains` on MongoDB compiles to `$regex` and does NOT escape the
 * needle, so a search for `.*` would match every product and a crafted term
 * could be used for catastrophic backtracking. Escaping here makes the search
 * behave as literal text, which is what a shopper expects.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface ProductListResult {
  products: ProductCard[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  facets: {
    categories: { id: string; name: string; slug: string; count: number }[];
    brands: { id: string; name: string; slug: string; count: number }[];
    sizes: { size: string; count: number }[];
    priceRange: { min: number; max: number } | null;
  };
}

interface ResolvedFilters {
  /** Category ids, resolved from the requested slugs. */
  categoryIds: string[];
  brandIds: string[];
  /** Brand/category ids whose *name* matches the free-text search term. */
  textCategoryIds: string[];
  textBrandIds: string[];
}

/**
 * A case-insensitive, literal "contains" filter for MongoDB.
 *
 * Prisma's MongoDB connector implements `contains` as a `$regex` built from the
 * value verbatim, and offers no `matches` operator, so the needle is escaped here
 * before it is handed over. Without this, a search for `.*` matches every
 * document and a crafted term invites catastrophic backtracking.
 */
function literalContains(needle: string): { contains: string; mode: "insensitive" } {
  return { contains: escapeRegExp(needle), mode: "insensitive" };
}

async function resolveFilterIds(query: ProductQuery): Promise<ResolvedFilters> {
  // Prisma's MongoDB connector does not honour a filter on a related model's
  // scalar (`category: { slug: { in: [...] } }` silently matches nothing), so
  // slugs and names are resolved to ids here and the products are matched on the
  // local foreign key instead.
  const term = query.q ? literalContains(query.q.slice(0, 120)) : null;

  const [categories, brands, textCategories, textBrands] = await Promise.all([
    query.category.length
      ? prisma.category.findMany({ where: { slug: { in: query.category } }, select: { id: true } })
      : Promise.resolve([]),
    query.brand.length
      ? prisma.brand.findMany({ where: { slug: { in: query.brand } }, select: { id: true } })
      : Promise.resolve([]),
    term
      ? prisma.category.findMany({ where: { name: term }, select: { id: true } })
      : Promise.resolve([]),
    term
      ? prisma.brand.findMany({ where: { name: term }, select: { id: true } })
      : Promise.resolve([]),
  ]);

  return {
    categoryIds: categories.map((c) => c.id),
    brandIds: brands.map((b) => b.id),
    textCategoryIds: textCategories.map((c) => c.id),
    textBrandIds: textBrands.map((b) => b.id),
  };
}

function buildWhere(query: ProductQuery, resolved?: ResolvedFilters): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ status: "ACTIVE" }];

  if (query.q) {
    const needle = query.q.slice(0, 120);
    const ci = literalContains(needle);
    and.push({
      OR: [
        { name: ci },
        { description: ci },
        { shortDescription: ci },
        { sku: ci },
        { tags: { has: needle.toLowerCase() } },
        { brandId: { in: resolved?.textBrandIds ?? [] } },
        { categoryId: { in: resolved?.textCategoryIds ?? [] } },
      ],
    });
  }

  if (query.category.length > 0) {
    and.push({ categoryId: { in: resolved?.categoryIds ?? [] } });
  }
  if (query.brand.length > 0) {
    and.push({ brandId: { in: resolved?.brandIds ?? [] } });
  }
  if (query.gender.length > 0) {
    and.push({ gender: { in: query.gender } });
  }
  if (query.size.length > 0) {
    and.push({
      sizes: { some: { size: { in: query.size }, isActive: true, stock: { gt: 0 } } },
    });
  }
  if (query.onSale) {
    and.push({ discountPrice: { not: null } });
  }
  if (query.inStock) {
    and.push({ totalStock: { gt: 0 } });
  }
  if (query.featured) {
    and.push({ featured: true });
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    // `minPrice`/`maxPrice` arrive in PAISA, like every other money value in
    // this codebase and like the facets returned below. The shopper-facing
    // rupee conversion happens in the filter UI, never here.
    const filter: Prisma.IntFilter = {};
    if (query.minPrice !== undefined) filter.gte = query.minPrice;
    if (query.maxPrice !== undefined) filter.lte = query.maxPrice;
    // `sortPrice` is the denormalised effective price, so this is a single
    // comparison rather than an OR over two columns.
    and.push({ sortPrice: filter });
  }

  return { AND: and };
}

export async function listProducts(query: ProductQuery): Promise<ProductListResult> {
  const resolved = await resolveFilterIds(query);
  const where = buildWhere(query, resolved);
  const skip = (query.page - 1) * query.perPage;

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: cardSelect,
      orderBy: orderByFor(query.sort),
      skip,
      take: query.perPage,
    }),
    prisma.product.count({ where }),
  ]);

  // Facets are computed for the filter set minus its own dimension, so the
  // counts stay stable as the shopper narrows down.
  const [categoryGroups, brandGroups, activeProducts, priceRange] = await Promise.all([
    prisma.product.groupBy({
      by: ["categoryId"],
      where: buildWhere({ ...query, category: [] }, resolved),
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ["brandId"],
      where: buildWhere({ ...query, brand: [] }, resolved),
      _count: { _all: true },
    }),
    // Fetch the ids rather than filtering on the `product` relation, which the
    // MongoDB connector does not honour for a related model's scalar.
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, sortPrice: true },
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { sortPrice: true },
      orderBy: { sortPrice: "asc" },
    }),
  ]);

  // Size availability across the whole active catalogue, so a shopper is not
  // shown a size that nothing in stock comes in.
  const sizeRows = await prisma.productSize.findMany({
    where: {
      isActive: true,
      stock: { gt: 0 },
      productId: { in: activeProducts.map((p) => p.id) },
    },
    select: { size: true },
  });

  const [categories, brands] = await Promise.all([
    prisma.category.findMany({
      where: { id: { in: categoryGroups.map((g) => g.categoryId) } },
      select: { id: true, name: true, slug: true },
    }),
    prisma.brand.findMany({
      where: { id: { in: brandGroups.map((g) => g.brandId) } },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const categoryCount = new Map(categoryGroups.map((g) => [g.categoryId, g._count._all]));
  const brandCount = new Map(brandGroups.map((g) => [g.brandId, g._count._all]));

  const sizeCounts = new Map<string, number>();
  for (const row of sizeRows) {
    sizeCounts.set(row.size, (sizeCounts.get(row.size) ?? 0) + 1);
  }

  // `sortPrice` is the effective price, so the advertised range matches the
  // numbers a shopper can actually filter on.
  const prices = priceRange.map((p) => p.sortPrice);
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;

  return {
    products: rows.map(toCard),
    total,
    page: query.page,
    perPage: query.perPage,
    totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    facets: {
      categories: categories
        .map((c) => ({ ...c, count: categoryCount.get(c.id) ?? 0 }))
        .sort((a, b) => b.count - a.count),
      brands: brands
        .map((b) => ({ ...b, count: brandCount.get(b.id) ?? 0 }))
        .sort((a, b) => b.count - a.count),
      sizes: [...sizeCounts.entries()]
        .map(([size, count]) => ({ size, count }))
        .sort((a, b) => a.size.localeCompare(b.size, undefined, { numeric: true })),
      priceRange: min !== null && max !== null ? { min, max } : null,
    },
  };
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      brand: { select: { id: true, name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true, kind: true } },
      images_rel: { orderBy: { sortOrder: "asc" } },
      sizes: { orderBy: { size: "asc" } },
      reviews: {
        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

export async function getFeaturedProducts(limit = 8): Promise<ProductCard[]> {
  const rows = await prisma.product.findMany({
    where: { status: "ACTIVE", featured: true, totalStock: { gt: 0 } },
    select: cardSelect,
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  });
  if (rows.length >= limit) return rows.map(toCard);

  // Top up with best sellers so the row is never short on a fresh catalogue.
  const filler = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      totalStock: { gt: 0 },
      id: { notIn: rows.map((r) => r.id) },
    },
    select: cardSelect,
    orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }],
    take: limit - rows.length,
  });
  return [...rows, ...filler].map(toCard);
}

export async function getNewArrivals(limit = 8): Promise<ProductCard[]> {
  const rows = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: cardSelect,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toCard);
}

export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  limit = 4
): Promise<ProductCard[]> {
  const rows = await prisma.product.findMany({
    where: { status: "ACTIVE", categoryId, id: { not: productId } },
    select: cardSelect,
    orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(toCard);
}

export async function getActiveCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
}

export async function getActiveBrands() {
  return prisma.brand.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

/** Distinct sizes actually stocked, used to build the size filter. */
export async function getAvailableSizes(): Promise<string[]> {
  // Filter on `productId` rather than the `product` relation: Prisma's MongoDB
  // connector silently ignores a filter on a related model's scalar, which
  // would return no sizes at all.
  const activeProducts = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  const rows = await prisma.productSize.findMany({
    where: {
      isActive: true,
      stock: { gt: 0 },
      productId: { in: activeProducts.map((p) => p.id) },
    },
    distinct: ["size"],
    select: { size: true },
    orderBy: { size: "asc" },
  });
  return rows.map((r) => r.size);
}

export async function incrementProductView(productId: string): Promise<void> {
  await prisma.product.updateMany({
    where: { id: productId },
    data: { viewCount: { increment: 1 } },
  });
}
