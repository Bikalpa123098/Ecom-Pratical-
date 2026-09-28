import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/guards";

/**
 * Account shell.
 *
 * The guard lives in the layout so no account page can ever render for a signed
 * out visitor, including a page added later.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile" },
] as const;

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser("/account");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          My account
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">
          Hello, {user.name}
        </h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Account" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-ink hover:bg-surface-alt"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>{children}</div>
      </div>
    </main>
  );
}
