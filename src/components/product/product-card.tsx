"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { formatNPR, formatDiscountPercent, effectivePrice } from "@/lib/constants";
import { GENDER_LABELS, type Gender } from "@/lib/constants";
import { useCart } from "@/components/cart/cart-provider";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

export interface ProductCardData {
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
  sizes: { size: string; stock: number; isActive: boolean }[];
  brand: { name: string; slug: string };
  category: { name: string; slug: string };
}

const FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#f3f0ea"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="26" fill="#a8a29e">Bikalpa</text></svg>`
  );

export function ProductCard({
  product,
  priority = false,
  isWishlisted = false,
}: {
  product: ProductCardData;
  priority?: boolean;
  isWishlisted?: boolean;
}) {
  const { add, pending } = useCart();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);

  const inStockSizes = product.sizes.filter((s) => s.isActive && s.stock > 0);
  const soldOut = product.totalStock <= 0 || inStockSizes.length === 0;
  const charge = effectivePrice(product.price, product.discountPrice);
  const percentOff = formatDiscountPercent(product.price, product.discountPrice);
  const singleSize = inStockSizes.length === 1 ? inStockSizes[0]?.size ?? null : null;
  const lowStock = product.totalStock > 0 && product.totalStock <= 5;

  async function onAdd() {
    // If the product only comes in one size, skip the picker entirely.
    const size = selectedSize ?? singleSize;
    if (!size) {
      setSizeError(true);
      return;
    }
    setSizeError(false);
    await add({ productId: product.id, size, quantity: 1 });
  }

  return (
    <article className="group relative flex flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-4/5 overflow-hidden rounded-2xl bg-paper"
      >
        <Image
          src={product.images[0] ?? FALLBACK}
          alt={product.name}
          fill
          sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 45vw"
          priority={priority}
          className={cn(
            "object-cover transition-transform duration-500 ease-out group-hover:scale-105",
            soldOut && "opacity-55 grayscale"
          )}
        />

        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {percentOff ? (
            <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white">
              {percentOff}% off
            </span>
          ) : null}
          {soldOut ? (
            <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-white">
              Sold out
            </span>
          ) : lowStock ? (
            <span className="rounded-full bg-warning-50 px-2.5 py-1 text-[11px] font-semibold text-warning-700">
              Only {product.totalStock} left
            </span>
          ) : null}
        </div>
      </Link>

      {isWishlisted ? (
        <span className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-surface/90 text-brand-600 shadow-soft">
          <Heart className="h-4 w-4 fill-current" />
        </span>
      ) : null}

      <div className="flex flex-1 flex-col px-0.5 pt-3.5">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
          {product.brand.name}
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-medium text-ink">
          <Link href={`/products/${product.slug}`} className="hover:text-brand-700">
            {product.name}
          </Link>
        </h3>

        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-ink">{formatNPR(charge)}</span>
          {percentOff ? (
            <span className="text-xs text-muted line-through">{formatNPR(product.price)}</span>
          ) : null}
        </div>

        {inStockSizes.length > 0 && inStockSizes.length <= 8 ? (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {inStockSizes.map((s) => (
              <button
                key={s.size}
                type="button"
                onClick={() => {
                  setSelectedSize(s.size);
                  setSizeError(false);
                }}
                className={cn(
                  "min-w-8 rounded-md border px-1.5 py-1 text-[11px] font-medium transition-colors",
                  selectedSize === s.size
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-line text-ink-soft hover:border-brand-300"
                )}
                aria-pressed={selectedSize === s.size}
              >
                {s.size}
              </button>
            ))}
          </div>
        ) : null}

        {sizeError ? (
          <p className="mt-2 text-[11px] text-danger-700">Please choose a size.</p>
        ) : null}

        <div className="mt-3 flex items-center gap-2 pt-0.5">
          <Button
            size="sm"
            variant={soldOut ? "secondary" : "primary"}
            disabled={soldOut || pending}
            onClick={onAdd}
            className="flex-1"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {soldOut ? "Out of stock" : "Add to bag"}
          </Button>
        </div>

        {product.colorHex ? (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
            <span
              className="h-3 w-3 rounded-full border border-line"
              style={{ backgroundColor: product.colorHex }}
            />
            {product.colorName ?? "Multi"}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="aspect-4/5 animate-pulse rounded-2xl bg-ink/5" />
      <div className="mt-3.5 space-y-2">
        <div className="h-2.5 w-1/3 animate-pulse rounded bg-ink/5" />
        <div className="h-3.5 w-4/5 animate-pulse rounded bg-ink/5" />
        <div className="h-3.5 w-1/3 animate-pulse rounded bg-ink/5" />
      </div>
    </div>
  );
}

export { GENDER_LABELS };
export type { Gender };
