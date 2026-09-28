"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard, ProductCardSkeleton } from "@/components/product/product-card";
import { ButtonLink } from "@/components/ui/button";
import { PRODUCT_SORT_LABELS, PRODUCT_SORTS } from "@/lib/constants";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import type { ProductCard as Card } from "@/server/services/products";

export function ProductGrid({
  products,
  page,
  totalPages,
}: {
  products: Card[];
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const currentParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (products.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-line-strong bg-surface px-6 py-20 text-center">
        <h2 className="font-display text-xl font-semibold">Nothing matches yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
          Try removing a filter or searching for a different style, brand or size.
        </p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href="/shop" variant="secondary">
            Clear all filters
          </ButtonLink>
        </div>
      </div>
    );
  }

  function goToPage(next: number) {
    const params = new URLSearchParams(currentParams.toString());
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  function setSort(sort: string) {
    const params = new URLSearchParams(currentParams.toString());
    params.set("sort", sort);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  const currentSort = currentParams.get("sort") ?? "newest";

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-line pb-3">
        <p className="text-xs text-muted">
          Showing {products.length} on this page
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-xs text-muted">
            Sort
          </label>
          <select
            id="sort"
            value={currentSort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 rounded-lg border border-line bg-surface px-2.5 text-xs text-ink outline-none focus:border-brand-500"
          >
            {PRODUCT_SORTS.map((s) => (
              <option key={s} value={s}>
                {PRODUCT_SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-2 gap-x-4 gap-y-8 transition-opacity md:grid-cols-3",
          pending && "opacity-50"
        )}
      >
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {totalPages > 1 ? (
        <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Pagination">
          <PageButton
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </PageButton>

          {pageNumbers(page, totalPages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="px-1 text-muted">
                …
              </span>
            ) : (
              <PageButton key={p} onClick={() => goToPage(p)} active={p === page}>
                {p}
              </PageButton>
            )
          )}

          <PageButton
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </PageButton>
        </nav>
      ) : null}
    </div>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  active,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      className={cn(
        "grid h-9 min-w-9 place-items-center rounded-lg border px-2.5 text-sm font-medium transition-colors disabled:opacity-40",
        active
          ? "border-brand-700 bg-brand-700 text-white"
          : "border-line text-ink-soft hover:border-brand-300 hover:text-ink"
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** 1 … 4 5 [6] 7 8 … 20 */
function pageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const out: (number | null)[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);

  if (from > 2) out.push(null);
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push(null);
  out.push(total);

  return out;
}

export { ProductCardSkeleton };
