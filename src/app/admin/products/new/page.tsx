import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/guards";
import { getProductFormOptions } from "@/server/services/admin-products";
import { ProductForm } from "@/components/admin/product-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · New product",
  robots: { index: false, follow: false },
};

export default async function NewProductPage() {
  await requireAdmin("/admin/products/new");
  const { categories, brands } = await getProductFormOptions();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/products" className="text-sm text-brand-600 hover:underline">
          ← Products
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">New product</h1>
      </div>

      <ProductForm product={null} categories={categories} brands={brands} />
    </div>
  );
}
