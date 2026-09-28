import Link from "next/link";
import { getActiveCategories } from "@/server/services/products";

/**
 * 404.
 *
 * Renders the category list from the database so the recovery links are always
 * current, and is a dynamic route because it may be shown for any unknown URL.
 */
export const dynamic = "force-dynamic";

export default async function NotFound() {
  const categories = await getActiveCategories();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <p className="font-display text-6xl font-semibold text-brand-600">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
        We could not find that page
      </h1>
      <p className="mt-2 text-sm text-muted">
        The link may be out of date, or the product may have sold out and been
        removed. Try a search, or pick a category below.
      </p>

      <form action="/shop" className="mt-6 w-full max-w-sm" role="search">
        <input
          type="search"
          name="q"
          placeholder="Search for shoes…"
          aria-label="Search products"
          className="h-11 w-full rounded-lg border border-line bg-surface px-4 text-sm outline-none focus:border-brand-500"
        />
      </form>

      {categories.length > 0 ? (
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/shop?category=${category.slug}`}
                className="inline-flex h-9 items-center rounded-full border border-line px-4 text-sm text-ink-soft hover:border-brand-500 hover:text-ink"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Back to home
      </Link>
    </main>
  );
}
