import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { formatNPR } from "@/lib/constants";
import { requireAdmin } from "@/server/guards";
import { listAdminProducts } from "@/server/services/admin";
import { StockAdjustForm } from "@/components/admin/stock-adjust-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · Products",
  robots: { index: false, follow: false },
};

const PER_PAGE = 20;

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  DRAFT: "bg-amber-50 text-amber-700",
  ARCHIVED: "bg-surface-alt text-muted",
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  await requireAdmin("/admin/products");
  const params = await searchParams;

  const requested = Number.parseInt(params.page ?? "1", 10);
  const result = await listAdminProducts({
    page: Number.isFinite(requested) ? requested : 1,
    status: params.status,
    q: params.q?.trim() || undefined,
    perPage: PER_PAGE,
  });

  const href = (overrides: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { status: params.status, q: params.q, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) search.set(key, value);
    }
    const query = search.toString();
    return query ? `/admin/products?${query}` : "/admin/products";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">Products</h1>
        <Link
          href="/admin/products/new"
          className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          New product
        </Link>
      </div>

      <form action="/admin/products" className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="block text-xs text-muted">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Name or SKU"
            className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-xs text-muted">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={params.status ?? ""}
            className="mt-1 h-10 rounded-lg border border-line bg-surface px-3 text-sm"
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Filter
        </button>
      </form>

      {result.products.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
          No products match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-3xl text-sm">
            <thead className="bg-surface-alt text-left text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Product</th>
                <th scope="col" className="px-4 py-3 font-medium">Category</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Price</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Stock</th>
                <th scope="col" className="px-4 py-3 font-medium">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.products.map((product) => (
                <tr key={product.id} className="bg-surface align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/products/${product.slug}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {product.name}
                    </Link>
                    <p className="font-mono text-xs text-muted">{product.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {product.categoryName}
                    <p className="text-xs">{product.brandName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_TONE[product.status] ?? STATUS_TONE.ARCHIVED
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-ink">
                    {formatNPR(product.effective)}
                    {product.effective < product.price ? (
                      <p className="text-xs text-muted line-through">
                        {formatNPR(product.price)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right text-ink">{product.totalStock}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      Edit
                    </Link>
                    <StockAdjustForm productId={product.id} totalStock={product.totalStock} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.totalPages > 1 ? (
        <nav aria-label="Product pages" className="flex items-center justify-between text-sm">
          {result.page > 1 ? (
            <Link href={href({ page: String(result.page - 1) })} className="text-brand-600 hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {result.page} of {result.totalPages} · {result.total} products
          </span>
          {result.page < result.totalPages ? (
            <Link href={href({ page: String(result.page + 1) })} className="text-brand-600 hover:underline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
