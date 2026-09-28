import "server-only";

import { prisma } from "@/lib/db";

/**
 * Admin product reads.
 *
 * Deliberately separate from the customer-facing `getProductBySlug`, which only
 * ever returns `ACTIVE` rows. The editor needs draft and archived products too,
 * so it must not reuse the storefront query.
 */

export interface AdminProductForm {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  shortDescription: string;
  price: number;
  discountPrice: number | null;
  gender: string;
  colorName: string;
  colorHex: string;
  material: string;
  images: string[];
  tags: string[];
  status: string;
  featured: boolean;
  categoryId: string;
  brandId: string;
  sizes: { size: string; stock: number; isActive: boolean }[];
}

export async function getProductForAdmin(
  id: string
): Promise<AdminProductForm | null> {
  const row = await prisma.product.findUnique({
    where: { id },
    include: { sizes: { orderBy: { size: "asc" } } },
  });
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    description: row.description,
    shortDescription: row.shortDescription ?? "",
    price: row.price,
    discountPrice: row.discountPrice,
    gender: row.gender,
    colorName: row.colorName ?? "",
    colorHex: row.colorHex ?? "",
    material: row.material ?? "",
    images: row.images,
    tags: row.tags,
    status: row.status,
    featured: row.featured,
    categoryId: row.categoryId,
    brandId: row.brandId,
    sizes: row.sizes.map((size) => ({
      size: size.size,
      stock: size.stock,
      isActive: size.isActive,
    })),
  };
}

/** Category and brand options for the editor's selects. */
export async function getProductFormOptions(): Promise<{
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
}> {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { categories, brands };
}
