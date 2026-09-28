import type { Metadata } from "next";
import { listProducts, getActiveCategories, getActiveBrands, getAvailableSizes } from "@/server/services/products";
import { productQuerySchema, type ProductQuery } from "@/lib/schemas";
import { ShopFilters } from "@/components/shop/shop-filters";
import { ProductGrid } from "@/components/shop/product-grid";

export const metadata: Metadata = {
  title: "Shop all shoes",
  description:
    "Browse every sneaker, sandal, boot and formal shoe at Bikalpa Shoes. Filter by size, brand, category and price.",
};

export const revalidate = 120;

type SearchParams = Record<string, string | string[] | undefined>;

/** Turns a Next.js searchParams object into the validated query shape. */
function toQuery(searchParams: SearchParams): ProductQuery {
  const first = (value: string | string[] | undefined): string | undefined => {
    if (Array.isArray(value)) return value[0];
    return value;
  };

  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    const v = first(value);
    if (v !== undefined && v !== "") raw[key] = v;
  }

  // `onSale`/`inStock`/`featured` are flags: present means true.
  for (const flag of ["onSale", "inStock", "featured"]) {
    if (searchParams[flag] !== undefined) raw[flag] = "true";
  }

  const parsed = productQuerySchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  // A malformed filter must never produce an unbounded query; fall back to the
  // first page of the newest products.
  return productQuerySchema.parse({});
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const query = toQuery(sp);

  const [result, categories, brands, sizes] = await Promise.all([
    listProducts(query),
    getActiveCategories(),
    getActiveBrands(),
    getAvailableSizes(),
  ]);

  const title = describeTitle(query, categories);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          {result.total === 0
            ? "No products match your filters."
            : `${result.total} ${result.total === 1 ? "product" : "products"} found`}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <ShopFilters
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            count: c._count.products,
          }))}
          brands={brands.map((b) => ({
            id: b.id,
            name: b.name,
            slug: b.slug,
            count: b._count.products,
          }))}
          sizes={sizes}
          priceRange={result.facets.priceRange}
          current={query}
        />

        <ProductGrid
          products={result.products}
          page={result.page}
          totalPages={result.totalPages}
        />
      </div>
    </div>
  );
}

function describeTitle(
  query: ProductQuery,
  categories: { id: string; name: string; slug: string }[]
): string {
  if (query.q) return `Results for “${query.q}”`;

  if (query.category.length === 1) {
    const match = categories.find((c) => c.slug === query.category[0]);
    if (match) return match.name;
  }

  return "All shoes";
}
