import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CartProvider } from "@/components/cart/cart-provider";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { getActiveCategories } from "@/server/services/products";
import { getCurrentUser } from "@/server/guards";
import { getCartView } from "@/server/services/cart";
import { getWishlist } from "@/server/services/wishlist";
import { env } from "@/lib/env";
import {
  freeDeliveryThresholdLabel,
  freeDeliveryThresholdPaisa,
  isFreeDeliveryEnabled,
} from "@/lib/store-config";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans-face", display: "swap" });
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: "Bikalpa Shoes | Footwear Store in Nepal",
    template: "%s | Bikalpa Shoes",
  },
  description:
    "Bikalpa Shoes is a Nepali footwear store offering men's, women's, unisex and kids' shoes with cash-on-delivery and eSewa payment across Nepal.",
  keywords: ["shoes Nepal", "buy shoes online Nepal", "eSewa payment", "footwear Kathmandu"],
  openGraph: {
    type: "website",
    siteName: "Bikalpa Shoes",
    locale: "en_NP",
  },
};

export const viewport: Viewport = {
  themeColor: "#1c1917",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [categories, user] = await Promise.all([getActiveCategories(), getCurrentUser()]);

  const [cart, wishlistCount] = await Promise.all([
    getCartView(user?.id ?? null),
    user ? getWishlist(user.id).then((w) => w.count) : Promise.resolve(0),
  ]);

  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <CartProvider initialItemCount={cart.itemCount}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
          >
            Skip to content
          </a>
          <SiteHeader
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              count: c._count.products,
            }))}
            user={
              user
                ? { name: user.name, email: user.email, role: user.role ?? "CUSTOMER" }
                : null
            }
            wishlistCount={wishlistCount}
            freeDeliveryLabel={
              isFreeDeliveryEnabled ? freeDeliveryThresholdLabel : null
            }
          />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter categories={categories.map((c) => ({ name: c.name, slug: c.slug }))} />
          <CartDrawer
            freeDeliveryThresholdPaisa={freeDeliveryThresholdPaisa}
            freeDeliveryEnabled={isFreeDeliveryEnabled}
          />
          <Toaster />
        </CartProvider>
      </body>
    </html>
  );
}
