"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { formatNPR, toRupees, GENDER_LABELS, GENDERS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import type { ProductQuery } from "@/lib/schemas";

interface Facet {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export function ShopFilters({
  categories,
  brands,
  sizes,
  priceRange,
  current,
}: {
  categories: Facet[];
  brands: Facet[];
  sizes: string[];
  priceRange: { min: number; max: number } | null;
  current: ProductQuery;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  /**
   * Applies a filter change. Values are always written explicitly, including
   * empty strings, so a cleared filter does not linger in the URL and fight the
   * defaults. Page resets to 1 because a narrowed result set rarely has as many
   * pages as the previous one.
   */
  const apply = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      if (!params.has("page")) params.set("page", "1");
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const toggleInList = (key: string, value: string) => {
    apply((params) => {
      const existing = (params.get(key) ?? "").split(",").filter(Boolean);
      const next = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : [...existing, value];
      if (next.length) params.set(key, next.join(","));
      else params.delete(key);
    });
  };

  const setFlag = (key: string, on: boolean) => {
    apply((params) => {
      if (on) params.set(key, "true");
      else params.delete(key);
    });
  };

  // The inputs are typed in rupees but the query string carries paisa, so
  // everything server-side (bounds, facets, formatNPR) stays in one unit.
  const setPrice = (key: "minPrice" | "maxPrice", rupees: string) => {
    const parsed = Number.parseFloat(rupees);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      apply((params) => params.delete(key));
      return;
    }
    const paisa = Math.round(parsed * 100);
    apply((params) => {
      if (paisa > 0) params.set(key, String(paisa));
      else params.delete(key);
    });
  };

  const clearAll = () => {
    startTransition(() => router.push(pathname, { scroll: false }));
  };

  const activeCount =
    current.category.length +
    current.brand.length +
    current.gender.length +
    current.size.length +
    (current.minPrice !== undefined ? 1 : 0) +
    (current.maxPrice !== undefined ? 1 : 0) +
    (current.onSale ? 1 : 0) +
    (current.inStock ? 1 : 0) +
    (current.featured ? 1 : 0);

  const minRupees = priceRange ? toRupees(priceRange.min) : 0;
  const maxRupees = priceRange ? toRupees(priceRange.max) : 0;

  const body = (
    <div className={cn("space-y-7", pending && "opacity-60")}>
      {activeCount > 0 ? (
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
        >
          <X className="h-3.5 w-3.5" />
          Clear all filters ({activeCount})
        </button>
      ) : null}

      <FilterGroup title="Category">
        {categories.map((c) => (
          <Check
            key={c.id}
            label={c.name}
            count={c.count}
            checked={current.category.includes(c.slug)}
            onChange={() => toggleInList("category", c.slug)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Brand">
        {brands.length === 0 ? <Empty /> : null}
        {brands.map((b) => (
          <Check
            key={b.id}
            label={b.name}
            count={b.count}
            checked={current.brand.includes(b.slug)}
            onChange={() => toggleInList("brand", b.slug)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Size (EU)">
        <div className="flex flex-wrap gap-1.5">
          {sizes.map((size) => {
            const active = current.size.includes(size);
            return (
              <button
                key={size}
                type="button"
                onClick={() => toggleInList("size", size)}
                aria-pressed={active}
                className={cn(
                  "min-w-10 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-line text-ink-soft hover:border-brand-300"
                )}
              >
                {size}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Price (Rs.)">
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={String(minRupees)}
            defaultValue={current.minPrice !== undefined ? toRupees(current.minPrice) : ""}
            onBlur={(e) => setPrice("minPrice", e.target.value)}
            className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm outline-none focus:border-brand-500"
            aria-label="Minimum price"
          />
          <span className="text-muted">–</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={String(maxRupees)}
            defaultValue={current.maxPrice !== undefined ? toRupees(current.maxPrice) : ""}
            onBlur={(e) => setPrice("maxPrice", e.target.value)}
            className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm outline-none focus:border-brand-500"
            aria-label="Maximum price"
          />
        </div>
        {priceRange ? (
          <p className="mt-2 text-[11px] text-muted">
            Catalogue ranges {formatNPR(priceRange.min)} – {formatNPR(priceRange.max)}
          </p>
        ) : null}
      </FilterGroup>

      <FilterGroup title="Category type">
        <div className="flex flex-wrap gap-1.5">
          {GENDERS.map((g) => {
            const active = current.gender.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleInList("gender", g)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-line text-ink-soft hover:border-brand-300"
                )}
              >
                {GENDER_LABELS[g]}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Availability">
        <Check
          label="In stock only"
          checked={Boolean(current.inStock)}
          onChange={() => setFlag("inStock", !current.inStock)}
        />
        <Check
          label="On sale"
          checked={Boolean(current.onSale)}
          onChange={() => setFlag("onSale", !current.onSale)}
        />
        <Check
          label="Featured"
          checked={Boolean(current.featured)}
          onChange={() => setFlag("featured", !current.featured)}
        />
      </FilterGroup>
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <div className="mb-4 lg:hidden">
        <Button
          variant="secondary"
          full
          onClick={() => setOpen(true)}
          className="justify-between"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeCount > 0 ? (
              <span className="rounded-full bg-brand-700 px-1.5 text-[10px] text-white">
                {activeCount}
              </span>
            ) : null}
          </span>
        </Button>
      </div>

      {/* Desktop rail */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2">
          {body}
        </div>
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-90 lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
            className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />
          <div className="animate-drawer-in absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-paper">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <span className="font-display text-base font-semibold">Filters</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close filters"
                className="rounded-lg p-2 text-ink-soft hover:bg-ink/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{body}</div>
            <div className="border-t border-line p-4">
              <Button full onClick={() => setOpen(false)}>
                Show results
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2.5 text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Check({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm hover:bg-ink/5">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 rounded border-line-strong text-brand-700 accent-brand-700"
      />
      <span className="flex-1 text-ink-soft">{label}</span>
      {typeof count === "number" ? (
        <span className="text-xs text-muted">{count}</span>
      ) : null}
    </label>
  );
}

function Empty() {
  return <p className="text-xs text-muted">None yet.</p>;
}
