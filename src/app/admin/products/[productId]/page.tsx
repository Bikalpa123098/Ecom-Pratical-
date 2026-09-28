import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/guards";
import { getProductFormOptions, getProductForAdmin } from "@/server/services/admin-products";
import { ProductForm } from "@/components/admin/product-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · Edit product",
  robots: { index: false, follow: false },
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await requireAdmin();
  const { productId } = await params;

  const [product, { categories, brands }] = await Promise.all([
    getProductForAdmin(productId),
    getProductFormOptions(),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/products" className="text-sm text-brand-600 hover:underline">
          ← Products
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{product.name}</h1>
        <p className="text-sm text-muted">/products/{product.slug}</p>
      </div>

      <ProductForm product={product} categories={categories} brands={brands} />
    </div>
  );
}
