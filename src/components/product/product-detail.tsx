"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart, Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNPR } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { useCart } from "@/components/cart/cart-provider";
import { addToCartAction, toggleWishlistAction } from "@/app/actions/cart-actions";
import { toast } from "sonner";

/**
 * Product gallery, size picker and add-to-bag panel.
 *
 * The client only ever sends `{ productId, size, quantity }`. The price, the
 * stock for the chosen size and the cart subtotal are all re-read on the server,
 * so tampering with this component cannot change what is charged.
 */

export interface DetailSize {
  size: string;
  stock: number;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  discountPrice: number | null;
  images: string[];
  description: string;
  shortDescription: string | null;
  colorName: string | null;
  colorHex: string | null;
  material: string | null;
  tags: string[];
  gender: string;
  brand: { name: string };
  category: { name: string; slug: string };
  sizes: DetailSize[];
  ratingAverage: number;
  ratingCount: number;
}

export function ProductPurchasePanel({
  product,
  isWishlisted,
  signedIn,
}: {
  product: ProductDetail;
  isWishlisted: boolean;
  signedIn: boolean;
}) {
  const { openDrawer } = useCart();
  const [selected, setSelected] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(isWishlisted);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const inStock = product.sizes.filter((s) => s.stock > 0);
  const outOfStock = product.sizes.filter((s) => s.stock <= 0);
  const chosen = product.sizes.find((s) => s.size === selected) ?? null;
  const price = product.discountPrice ?? product.price;
  const compareAt = product.discountPrice ? product.price : null;
  const savings = compareAt ? compareAt - product.discountPrice! : 0;
  const canAdd = Boolean(chosen && chosen.stock > 0) && !busy;

  async function handleAdd() {
    if (!selected) {
      toast.error("Please choose a size first.");
      return;
    }
    setBusy(true);
    const result = await addToCartAction({ productId: product.id, size: selected, quantity: 1 });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.message ?? "We could not add that to your bag.");
      return;
    }
    toast.success("Added to your bag.");
    openDrawer();
  }

  async function handleWishlist() {
    if (!signedIn) {
      toast.error("Please sign in to save items to your wishlist.");
      return;
    }
    setSaving(true);
    const result = await toggleWishlistAction(product.id);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.message ?? "We could not update your wishlist.");
      return;
    }
    setWishlisted(result.data?.added ?? false);
    toast.success(result.data?.added ? "Saved to your wishlist." : "Removed from your wishlist.");
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-display text-3xl font-semibold text-ink">
            {formatNPR(price)}
          </span>
          {compareAt ? (
            <>
              <span className="text-base text-muted line-through">{formatNPR(compareAt)}</span>
              <span className="rounded-full bg-danger-50 px-2.5 py-1 text-xs font-semibold text-danger-700">
                Save {formatNPR(savings)}
              </span>
            </>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted">
          Price includes all taxes. Delivery is calculated at checkout.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Select size</h2>
          {chosen && chosen.stock <= 5 ? (
            <span className="text-xs font-medium text-danger-600">
              Only {chosen.stock} left
            </span>
          ) : null}
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {product.sizes.map((s) => {
            const disabled = s.stock <= 0;
            const isSelected = selected === s.size;
            return (
              <button
                key={s.size}
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => setSelected(s.size)}
                title={disabled ? "Out of stock" : `${s.stock} in stock`}
                className={cn(
                  "min-w-14 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors",
                  disabled &&
                    "cursor-not-allowed border-line bg-paper text-muted line-through opacity-60",
                  !disabled && !isSelected &&
                    "border-line-strong bg-surface text-ink hover:border-brand-400",
                  isSelected && "border-brand-700 bg-brand-700 text-white"
                )}
              >
                {s.size}
              </button>
            );
          })}
        </div>

        {!selected && outOfStock.length === 0 ? (
          <p className="mt-2 text-xs text-ink-faint">Please choose a size to continue.</p>
        ) : null}
        {inStock.length === 0 ? (
          <p className="mt-2 text-sm font-medium text-danger-600">
            This size range is sold out. Check back soon.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={handleAdd} disabled={!canAdd} className="flex-1">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ShoppingBag className="h-4 w-4" aria-hidden />
          )}
          {busy ? "Adding…" : "Add to bag"}
        </Button>

        <Button
          size="lg"
          variant="secondary"
          onClick={handleWishlist}
          disabled={saving}
          aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
          aria-pressed={wishlisted}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Heart className={cn("h-4 w-4", wishlisted && "fill-danger-500 text-danger-600")} aria-hidden />
          )}
          <span className="sm:hidden lg:inline">{wishlisted ? "Saved" : "Save"}</span>
        </Button>
      </div>

      <ul className="space-y-2 border-t border-line pt-5 text-sm text-ink-soft">
        <li className="flex items-center justify-between gap-4">
          <span>SKU</span>
          <span className="font-mono text-xs text-ink">{product.sku}</span>
        </li>
        {product.colorName ? (
          <li className="flex items-center justify-between gap-4">
            <span>Colour</span>
            <span className="flex items-center gap-2 text-ink">
              {product.colorHex ? (
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 rounded-full border border-line-strong"
                  style={{ backgroundColor: product.colorHex }}
                />
              ) : null}
              {product.colorName}
            </span>
          </li>
        ) : null}
        {product.material ? (
          <li className="flex items-center justify-between gap-4">
            <span>Material</span>
            <span className="text-ink">{product.material}</span>
          </li>
        ) : null}
        <li className="flex items-center justify-between gap-4">
          <span>Category</span>
          <span className="text-ink">{product.category.name}</span>
        </li>
      </ul>
    </div>
  );
}

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const list: string[] = images.length > 0 ? images : ["/images/placeholder.svg"];
  const current = list[active] ?? list[0]!;

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-paper">
        <Image
          key={current}
          src={current}
          alt={`${name} — image ${active + 1} of ${list.length}`}
          fill
          priority={active === 0}
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="animate-fade-in object-contain p-6"
        />
      </div>

      {list.length > 1 ? (
        <div className="flex gap-2.5" role="tablist" aria-label="Product images">
          {list.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`View image ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn(
                "relative h-16 w-16 overflow-hidden rounded-lg border bg-paper transition-colors",
                i === active ? "border-brand-700" : "border-line hover:border-brand-300"
              )}
            >
              <Image src={src} alt="" fill sizes="64px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
