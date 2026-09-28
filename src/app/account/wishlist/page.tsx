import "server-only";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { formatNPR } from "@/lib/constants";
import { requireUser } from "@/server/guards";
import { getWishlist } from "@/server/services/wishlist";
import { RemoveWishlistButton } from "@/components/account/remove-wishlist-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

export default async function AccountWishlistPage() {
  const user = await requireUser("/account/wishlist");
  const wishlist = await getWishlist(user.id);

  if (wishlist.items.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-ink">Wishlist</h2>
        <div className="mt-4 rounded-2xl border border-dashed border-line p-10 text-center">
          <Heart className="mx-auto size-8 text-muted" aria-hidden />
          <p className="mt-3 text-sm text-muted">
            Nothing saved yet. Tap the heart on any product to keep it here.
          </p>
          <Link
            href="/shop"
            className="mt-4 inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Browse shoes
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-ink">Wishlist</h2>
        <p className="text-sm text-muted">
          {wishlist.count} {wishlist.count === 1 ? "item" : "items"}
        </p>
      </div>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {wishlist.items.map((item) => (
          <li
            key={item.id}
            className="flex gap-4 rounded-2xl border border-line bg-surface p-4"
          >
            <Link
              href={`/products/${item.slug}`}
              className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-surface-alt"
            >
              {item.image ? (
                <Image src={item.image} alt="" fill sizes="96px" className="object-cover" />
              ) : null}
            </Link>

            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-xs text-muted">{item.brandName}</p>
              <Link
                href={`/products/${item.slug}`}
                className="mt-0.5 text-sm font-medium text-ink hover:underline"
              >
                {item.name}
              </Link>
              <p className="mt-1 text-sm font-semibold text-ink">
                {formatNPR(item.price)}
              </p>
              {item.unitMrp > item.price ? (
                <p className="text-xs text-muted line-through">
                  {formatNPR(item.unitMrp)}
                </p>
              ) : null}
              <p
                className={`mt-1 text-xs font-medium ${
                  item.inStock ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {item.inStock ? "In stock" : "Out of stock"}
              </p>

              <div className="mt-auto pt-3">
                <RemoveWishlistButton productId={item.productId} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
