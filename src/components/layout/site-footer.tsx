import Link from "next/link";
import { Phone, MapPin, Mail } from "lucide-react";
import { formatNPR, toPaisa } from "@/lib/constants";
import { env } from "@/lib/env";

export function SiteFooter({
  categories,
}: {
  categories: { name: string; slug: string }[];
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-paper">
                <span className="font-display text-sm font-semibold">B</span>
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-display text-lg font-semibold">Bikalpa</span>
                <span className="text-[9px] font-medium tracking-[0.22em] text-muted uppercase">
                  Shoes
                </span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
              Hand-picked footwear for every Nepali doorstep. Pay with eSewa or cash on
              delivery, anywhere in Nepal.
            </p>
          </div>

          <FooterColumn title="Shop">
            <FooterLink href="/shop">All shoes</FooterLink>
            {categories.slice(0, 6).map((c) => (
              <FooterLink key={c.slug} href={`/shop?category=${c.slug}`}>
                {c.name}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Help">
            <FooterLink href="/shipping">Shipping &amp; delivery</FooterLink>
            <FooterLink href="/returns">Returns &amp; exchange</FooterLink>
            <FooterLink href="/faq">FAQ</FooterLink>
            <FooterLink href="/contact">Contact us</FooterLink>
          </FooterColumn>

          <FooterColumn title="Account">
            <FooterLink href="/login">Sign in</FooterLink>
            <FooterLink href="/register">Create account</FooterLink>
            <FooterLink href="/account/orders">My orders</FooterLink>
            <FooterLink href="/account/wishlist">Wishlist</FooterLink>
            <FooterLink href="/account/addresses">Addresses</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {year} Bikalpa Shoes. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a
              href={`tel:${env.STORE_PHONE.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1.5 hover:text-ink"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden /> {env.STORE_PHONE}
            </a>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {env.STORE_ADDRESS}
            </span>
            <a
              href={`mailto:${env.STORE_EMAIL}`}
              className="inline-flex items-center gap-1.5 hover:text-ink"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden /> {env.STORE_EMAIL}
            </a>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            Prices shown in Nepali Rupees. Delivery inside the Kathmandu Valley is{" "}
            {formatNPR(toPaisa(env.DELIVERY_CHARGE_INSIDE_VALLEY_RUPEES))}, and free on
            orders over {formatNPR(env.FREE_DELIVERY_THRESHOLD_PAISA)}.
          </p>
          <p className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">
        {title}
      </h2>
      <ul className="space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-ink-soft transition-colors hover:text-brand-700">
        {children}
      </Link>
    </li>
  );
}
