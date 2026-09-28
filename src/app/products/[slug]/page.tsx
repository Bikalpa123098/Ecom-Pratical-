import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Star, Truck, Wallet, RotateCcw, ShieldCheck } from "lucide-react";
import {
  getProductBySlug,
  getRelatedProducts,
  incrementProductView,
} from "@/server/services/products";
import { getCurrentUser } from "@/server/guards";
import { getWishlist } from "@/server/services/wishlist";
import { formatDiscountPercent, formatNPR } from "@/lib/constants";
import { ProductCard } from "@/components/product/product-card";
import {
  ProductGallery,
  ProductPurchasePanel,
  type ProductDetail,
} from "@/components/product/product-detail";

/**
 * Product detail.
 *
 * The page renders only ACTIVE products; a draft is indistinguishable from a
 * missing slug, so unpublished stock cannot be discovered by guessing URLs.
 *
 * Ratings come from stored aggregates rather than from anything the client
 * sends, and the structured data below advertises the effective price, which is
 * the discount price whenever one is set.
 */

export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  // Only the slugs worth pre-rendering; the rest render on demand.
  // `productQuerySchema` is parsed rather than hand-built so the defaults here
  // can never diverge from the ones the shop page uses.
  const { listProducts } = await import("@/server/services/products");
  const { productQuerySchema } = await import("@/lib/schemas");
  const { products } = await listProducts(
    productQuerySchema.parse({ perPage: 40, sort: "newest" })
  );
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) return { title: "Product not found" };

  const price = product.discountPrice ?? product.price;
  const description =
    product.shortDescription ??
    `Buy ${product.name} by ${product.brand.name} at Bikalpa Shoes. ${formatNPR(price)}. Pay with eSewa or cash on delivery across Nepal.`;

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      images: product.images[0] ? [product.images[0]] : undefined,
    },
    alternates: { canonical: `/products/${product.slug}` },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const [user, related] = await Promise.all([
    getCurrentUser(),
    getRelatedProducts(product.id, product.categoryId, 4),
  ]);

  const wishlist = user ? await getWishlist(user.id) : null;
  const isWishlisted = wishlist?.items.some((i) => i.productId === product.id) ?? false;

  // Fire-and-forget: a failed view counter must never break the page.
  void incrementProductView(product.id).catch(() => undefined);

  const price = product.discountPrice ?? product.price;
  const discountPercent = formatDiscountPercent(product.price, product.discountPrice);
  const totalStock = product.sizes.reduce((sum, s) => sum + s.stock, 0);

  const detail: ProductDetail = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    price: product.price,
    discountPrice: product.discountPrice,
    images: product.images_rel.length
      ? product.images_rel.map((i) => i.url)
      : product.images,
    description: product.description,
    shortDescription: product.shortDescription,
    colorName: product.colorName,
    colorHex: product.colorHex,
    material: product.material,
    tags: product.tags,
    gender: product.gender,
    brand: product.brand,
    category: product.category,
    sizes: product.sizes.map((s) => ({ size: s.size, stock: s.stock })),
    ratingAverage: product.ratingAverage,
    ratingCount: product.ratingCount,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-xs text-ink-soft">
        <Link href="/" className="hover:text-ink hover:underline">
          Home
        </Link>
        <ChevronRight className="h-3 w-3 text-muted" aria-hidden />
        <Link href="/shop" className="hover:text-ink hover:underline">
          All shoes
        </Link>
        <ChevronRight className="h-3 w-3 text-muted" aria-hidden />
        <Link href={`/shop?category=${product.category.slug}`} className="hover:text-ink hover:underline">
          {product.category.name}
        </Link>
        <ChevronRight className="h-3 w-3 text-muted" aria-hidden />
        <span className="font-medium text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={detail.images} name={product.name} />

        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/shop?brand=${product.brand.slug}`}
              className="text-xs font-semibold tracking-[0.16em] text-brand-700 uppercase hover:underline"
            >
              {product.brand.name}
            </Link>
            {discountPercent ? (
              <span className="rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-semibold text-danger-700">
                {discountPercent}% off
              </span>
            ) : null}
          </div>

          <h1 className="mt-2 font-display text-3xl leading-tight font-semibold text-ink sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            {product.ratingCount > 0 ? (
              <span className="flex items-center gap-1.5">
                <span className="flex" aria-hidden>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={
                        i < Math.round(product.ratingAverage)
                          ? "h-3.5 w-3.5 fill-warning-400 text-warning-500"
                          : "h-3.5 w-3.5 text-line-strong"
                      }
                    />
                  ))}
                </span>
                <span className="text-ink-soft">{product.ratingAverage.toFixed(1)}</span>
                <span className="text-muted">({product.ratingCount})</span>
              </span>
            ) : null}

            {totalStock > 0 && totalStock <= 10 ? (
              <span className="font-medium text-danger-600">
                Only {totalStock} left in stock
              </span>
            ) : totalStock > 0 ? (
              <span className="text-success-700">In stock</span>
            ) : (
              <span className="font-medium text-danger-600">Sold out</span>
            )}
          </div>

          {product.shortDescription ? (
            <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
              {product.shortDescription}
            </p>
          ) : null}

          <div className="mt-7">
            <ProductPurchasePanel
              product={detail}
              isWishlisted={isWishlisted}
              signedIn={Boolean(user)}
            />
          </div>
        </div>
      </div>

      <section className="mt-14 grid gap-10 border-t border-line pt-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="font-display text-xl font-semibold text-ink">Product details</h2>
          <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-soft">
            {product.description.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {detail.tags.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-2">
              {detail.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-soft"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="space-y-4">
          <DetailCard icon={<Truck className="h-5 w-5" />} title="Delivery">
            1–3 working days inside Kathmandu Valley, 3–7 days elsewhere in Nepal.
          </DetailCard>
          <DetailCard icon={<Wallet className="h-5 w-5" />} title="Pay your way">
            eSewa or cash on delivery. Every payment is verified with eSewa before the order
            is confirmed.
          </DetailCard>
          <DetailCard icon={<RotateCcw className="h-5 w-5" />} title="Returns">
            Wrong size or not as expected? Exchange within 7 days of delivery.
          </DetailCard>
          <DetailCard icon={<ShieldCheck className="h-5 w-5" />} title="Authentic">
            Every pair is quality-checked before it is packed.
          </DetailCard>
        </div>
      </section>

      {product.reviews.length > 0 ? (
        <section className="mt-14 border-t border-line pt-10">
          <h2 className="font-display text-xl font-semibold text-ink">
            Reviews ({product.ratingCount})
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {product.reviews.map((review) => (
              <li key={review.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center gap-3">
                  {review.user.image ? (
                    <Image
                      src={review.user.image}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                      {review.user.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-medium text-ink">{review.user.name}</p>
                    <span className="flex" aria-label={`${review.rating} out of 5`}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={
                            i < review.rating
                              ? "h-3 w-3 fill-warning-400 text-warning-500"
                              : "h-3 w-3 text-line-strong"
                          }
                        />
                      ))}
                    </span>
                  </div>
                </div>
                {review.title ? (
                  <p className="mt-3 text-sm font-semibold text-ink">{review.title}</p>
                ) : null}
                {review.body ? <p className="mt-1 text-sm text-ink-soft">{review.body}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className="mt-14 border-t border-line pt-10">
          <h2 className="font-display text-xl font-semibold text-ink">You may also like</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      <ProductStructuredData
        product={{
          name: product.name,
          description: product.shortDescription ?? product.description.slice(0, 300),
          sku: product.sku,
          image: detail.images[0],
          price,
          currency: "NPR",
          availability: totalStock > 0 ? "InStock" : "OutOfStock",
          brand: product.brand.name,
        }}
      />
    </div>
  );
}

function DetailCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-surface p-4">
      <span className="shrink-0 text-brand-700">{icon}</span>
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-sm text-ink-soft">{children}</p>
      </div>
    </div>
  );
}

function ProductStructuredData({
  product,
}: {
  product: {
    name: string;
    description: string;
    sku: string;
    image?: string;
    price: number;
    currency: string;
    availability: string;
    brand: string;
  };
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    image: product.image,
    brand: { "@type": "Brand", name: product.brand },
    offers: {
      "@type": "Offer",
      price: (product.price / 100).toFixed(2),
      priceCurrency: product.currency,
      availability:
        product.availability === "InStock"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  return (
    <script
      type="application/ld+json"
      // Serialised from a fixed shape above, so there is nothing user-controlled to escape.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
