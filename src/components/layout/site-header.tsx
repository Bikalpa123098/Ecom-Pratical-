"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  LayoutGrid,
  LogOut,
  Menu,
  Search,
  ShoppingBag,
  User as UserIcon,
  X,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { useCart } from "@/components/cart/cart-provider";
import { cn } from "@/lib/cn";

export interface HeaderCategory {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface HeaderUser {
  name: string | null;
  email: string;
  role: string;
}

export function SiteHeader({
  categories,
  user,
  wishlistCount,
  freeDeliveryLabel,
}: {
  categories: HeaderCategory[];
  user: HeaderUser | null;
  wishlistCount: number;
  /** e.g. "Rs. 5,000" — comes from the same env var checkout charges against. */
  freeDeliveryLabel: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { openDrawer, itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  // Condense the bar once the page scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close transient panels on navigation. Keying the panels on the pathname
  // unmounts them on route change, which avoids resetting state from an effect.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const primaryCategories = categories.filter((c) => c.count > 0).slice(0, 5);

  return (
    <>
      <a href="#main" className="sr-only" tabIndex={-1}>
        Skip to content
      </a>

      <div className="bg-ink text-paper/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-[11px] tracking-wide sm:px-6">
          <p className="truncate">
            {freeDeliveryLabel
              ? `Free delivery inside Kathmandu Valley on orders over ${freeDeliveryLabel}`
              : "Free delivery inside Kathmandu Valley"}
          </p>
          <div className="hidden shrink-0 items-center gap-4 sm:flex">
            <span className="text-paper/70">Pay with eSewa or cash on delivery</span>
          </div>
        </div>
      </div>

      <header
        className={cn(
          "sticky top-0 z-50 border-b bg-paper/90 backdrop-blur-md transition-shadow",
          scrolled ? "border-line shadow-soft" : "border-transparent"
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            className={cn(
              "flex items-center justify-between gap-4 transition-all",
              scrolled ? "h-14" : "h-16 md:h-20"
            )}
          >
            {/* Left: nav toggle (mobile) */}
            <div className="flex items-center gap-1 lg:hidden">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                className="-ml-2 rounded-lg p-2 text-ink-soft hover:bg-ink/5 hover:text-ink"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>

            {/* Wordmark */}
            <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Bikalpa Shoes home">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-paper">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path
                    d="M3 15.5c1.2 0 2.1-.4 3.1-1.2l1.6-1.3c.4-.3.9-.5 1.4-.5.5 0 1 .2 1.4.5l3.4 2.7c.9.7 1.9 1.1 3 1.1h2.1c.8 0 1.5.7 1.5 1.5v.7c0 .6-.5 1.1-1.1 1.1H4.6A1.6 1.6 0 0 1 3 18.5v-3Z"
                    fill="currentColor"
                    opacity=".9"
                  />
                  <path
                    d="M3 15.5V8.2c0-.4.4-.6.7-.4l1.3.9c.4.3.4.8 0 1.1l-.8.7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10.5 12.3 15 8.8c1.3-1 2.9-1.7 4.6-2 .4-.1.7.3.6.7l-.8 3.4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-display text-lg font-semibold tracking-tight text-ink">
                  Bikalpa
                </span>
                <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-muted">
                  Shoes
                </span>
              </span>
            </Link>

            {/* Center: category nav (desktop) */}
            <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex" aria-label="Product categories">
              <NavLink href="/shop">All shoes</NavLink>
              {primaryCategories.map((c) => (
                <NavLink key={c.id} href={`/shop?category=${c.slug}`}>
                  {c.name}
                </NavLink>
              ))}
            </nav>

            {/* Right: actions */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              <IconButton onClick={() => setSearchOpen((v) => !v)} label="Search">
                <Search className="h-[18px] w-[18px]" />
              </IconButton>

              {user ? (
                <Link
                  href="/account/wishlist"
                  className="relative rounded-lg p-2 text-ink-soft hover:bg-ink/5 hover:text-ink"
                  aria-label={`Wishlist, ${wishlistCount} items`}
                >
                  <Heart className="h-[18px] w-[18px]" />
                  {wishlistCount > 0 && <CountBadge value={wishlistCount} />}
                </Link>
              ) : null}

              <Link
                href={user ? "/account" : "/login"}
                className="rounded-lg p-2 text-ink-soft hover:bg-ink/5 hover:text-ink"
                aria-label={user ? "Your account" : "Sign in"}
              >
                <UserIcon className="h-[18px] w-[18px]" />
              </Link>

              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-lg p-2 text-ink-soft hover:bg-ink/5 hover:text-ink"
                  aria-label="Sign out"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={openDrawer}
                className="relative rounded-lg p-2 text-ink-soft hover:bg-ink/5 hover:text-ink"
                aria-label={`Your bag, ${itemCount} items`}
              >
                <ShoppingBag className="h-[18px] w-[18px]" />
                {itemCount > 0 && <CountBadge value={itemCount} />}
              </button>
            </div>
          </div>

          {searchOpen ? (
            <SearchPanel key={`search-${pathname}`} onClose={() => setSearchOpen(false)} />
          ) : null}
        </div>
      </header>

      {menuOpen ? (
        <MobileMenu
          key={`menu-${pathname}`}
          categories={categories}
          user={user}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
    >
      {children}
    </Link>
  );
}

function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-lg p-2 text-ink-soft hover:bg-ink/5 hover:text-ink"
    >
      {children}
    </button>
  );
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="absolute -top-0.5 -right-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");

  return (
    <form
      action="/shop"
      onSubmit={onClose}
      className="animate-fade-in border-t border-line py-3"
      role="search"
    >
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search for sneakers, sandals, formal shoes…"
          autoFocus
          className="h-10 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="rounded-lg p-1.5 text-muted hover:bg-ink/5 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

function MobileMenu({
  categories,
  user,
  onClose,
}: {
  categories: HeaderCategory[];
  user: HeaderUser | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-90 lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div className="animate-drawer-in absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-paper shadow-lift">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="font-display text-base font-semibold">Menu</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-2 text-ink-soft hover:bg-ink/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Mobile navigation">
          <p className="px-2 pb-2 text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
            Shop
          </p>
          <ul className="mb-6 space-y-0.5">
            <li>
              <MobileLink href="/shop" icon={<LayoutGrid className="h-4 w-4" />}>
                All shoes
              </MobileLink>
            </li>
            {categories
              .filter((c) => c.count > 0)
              .map((c) => (
                <li key={c.id}>
                  <MobileLink href={`/shop?category=${c.slug}`} count={c.count}>
                    {c.name}
                  </MobileLink>
                </li>
              ))}
          </ul>

          <p className="px-2 pb-2 text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
            Account
          </p>
          <ul className="space-y-0.5">
            {user ? (
              <>
                <li>
                  <MobileLink href="/account" icon={<UserIcon className="h-4 w-4" />}>
                    {user.name ?? "My account"}
                  </MobileLink>
                </li>
                <li>
                  <MobileLink href="/account/wishlist" icon={<Heart className="h-4 w-4" />}>
                    Wishlist
                  </MobileLink>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      void signOut();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-ink-soft hover:bg-ink/5 hover:text-ink"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <MobileLink href="/login" icon={<UserIcon className="h-4 w-4" />}>
                    Sign in
                  </MobileLink>
                </li>
                <li>
                  <MobileLink href="/register" icon={<UserIcon className="h-4 w-4" />}>
                    Create account
                  </MobileLink>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function MobileLink({
  href,
  children,
  icon,
  count,
}: {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-ink/5 hover:text-ink"
    >
      {icon}
      <span className="flex-1">{children}</span>
      {typeof count === "number" ? (
        <span className="text-xs text-muted">{count}</span>
      ) : null}
    </Link>
  );
}
