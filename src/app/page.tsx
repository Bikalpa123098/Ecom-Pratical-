import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  Truck,
  Wallet,
} from "lucide-react";
import { getFeaturedProducts, getNewArrivals, getActiveCategories } from "@/server/services/products";
import { ProductCard } from "@/components/product/product-card";
import { ButtonLink } from "@/components/ui/button";
import { freeDeliveryThresholdLabel, isFreeDeliveryEnabled } from "@/lib/store-config";

export const metadata: Metadata = {
  title: "Footwear for every Nepali doorstep",
  description:
    "Shop sneakers, sandals, formal shoes and kids' footwear at Bikalpa Shoes. Pay with eSewa or cash on delivery anywhere in Nepal.",
};

export const revalidate = 300;

export default async function HomePage() {
  const [featured, arrivals, categories] = await Promise.all([
    getFeaturedProducts(8),
    getNewArrivals(8),
    getActiveCategories(),
  ]);

  // New arrivals double as the featured grid when there is nothing flagged.
  const grid = (featured.length > 0 ? featured : arrivals).slice(0, 8);
  const showcase = arrivals.length > 0 ? arrivals : featured;

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800">
              New season, new steps
            </p>
            <h1 className="mt-5 font-display text-4xl leading-[1.08] font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Footwear that feels
              <br />
              made for Nepal.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-soft">
              Everyday sneakers, honest leather and comfortable sandals — chosen to
              survive Nepali roads, monsoons and long festival walks. Pay with eSewa
              or cash on delivery.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/shop" size="lg">
                Shop all shoes
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/shop?sort=newest" size="lg" variant="secondary">
                See what&apos;s new
              </ButtonLink>
            </div>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6">
              <Stat value="Nationwide" label="Delivery across Nepal" />
              <Stat value="eSewa" label="Secure digital payment" />
              <Stat value="7 days" label="Easy returns" />
            </dl>
          </div>

          <div className="relative">
            <div className="relative aspect-square overflow-hidden rounded-3xl bg-gradient-to-br from-brand-100 via-brand-50 to-paper">
              <Image
                src="/images/hero.svg"
                alt="A curated selection of Bikalpa Shoes footwear"
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-contain p-8"
              />
            </div>
            <div className="absolute -bottom-5 -left-4 hidden rounded-2xl border border-line bg-surface p-4 shadow-lift sm:block">
              <p className="text-[11px] tracking-wide text-muted uppercase">Free delivery</p>
              <p className="font-display text-lg font-semibold">Inside the Valley</p>
              <p className="text-xs text-ink-soft">
                {isFreeDeliveryEnabled ? `On orders over ${freeDeliveryThresholdLabel}` : "Inside the Valley"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-paper">
        <div className="mx-auto grid max-w-7xl gap-px px-4 py-8 sm:px-6 md:grid-cols-4">
          <Perk icon={<Truck className="h-5 w-5" />} title="Fast delivery">
            1–3 days in the Valley, 3–7 days elsewhere.
          </Perk>
          <Perk icon={<Wallet className="h-5 w-5" />} title="eSewa & COD">
            Pay however suits you. Verified payments only.
          </Perk>
          <Perk icon={<RotateCcw className="h-5 w-5" />} title="Easy returns">
            Wrong size? Exchange within 7 days.
          </Perk>
          <Perk icon={<ShieldCheck className="h-5 w-5" />} title="Genuine products">
            Real stock, no phantom listings.
          </Perk>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <SectionHead
            title="Shop by category"
            href="/shop"
            linkLabel="All categories"
          />
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.slice(0, 8).map((c) => (
              <Link
                key={c.id}
                href={`/shop?category=${c.slug}`}
                className="group relative flex aspect-3/2 items-end overflow-hidden rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-300"
              >
                <span className="absolute inset-0 bg-gradient-to-t from-ink/55 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="relative">
                  <span className="block font-display text-lg font-semibold text-ink">
                    {c.name}
                  </span>
                  <span className="text-xs text-muted group-hover:text-paper/80">
                    {c._count.products}{" "}
                    {c._count.products === 1 ? "product" : "products"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {grid.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <SectionHead title="Featured" href="/shop?featured=1" linkLabel="View all" />
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {grid.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <EmptyCatalogue />
        </section>
      )}

      {showcase.length > 0 && showcase !== grid ? (
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <SectionHead title="New arrivals" href="/shop?sort=newest" linkLabel="See all" />
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {showcase.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Not sure about your size?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-soft">
            Our size guide uses the EU sizing that Nepali brands print on the box.
            Measure your foot from heel to longest toe and pick the next size up for
            wide feet.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/size-guide" variant="secondary">
              Size guide
            </ButtonLink>
            <ButtonLink href="/contact">Ask us anything</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-display text-lg font-semibold text-ink">{value}</dt>
      <dd className="mt-0.5 text-xs leading-snug text-muted">{label}</dd>
    </div>
  );
}

function Perk({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  );
}

function SectionHead({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <Link
        href={href}
        className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
      >
        {linkLabel}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

function EmptyCatalogue() {
  return (
    <div className="rounded-3xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
      <h2 className="font-display text-2xl font-semibold">The shelf is empty for now</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft">
        No products have been published yet. Once an administrator adds inventory in
        the admin dashboard, they will appear here.
      </p>
    </div>
  );
}
