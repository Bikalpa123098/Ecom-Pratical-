import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import {
  Boxes,
  LayoutDashboard,
  Package,
  Receipt,
  Users,
} from "lucide-react";
import { requireAdmin } from "@/server/guards";

/**
 * Admin shell.
 *
 * `requireAdmin()` in the layout means no admin page can render for a customer
 * or a signed-out visitor, including one added later. The guard runs on the
 * server; the pages it protects are all server components, so nothing sensitive
 * is ever shipped and then hidden.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", Icon: Receipt },
  { href: "/admin/products", label: "Products", Icon: Package },
  { href: "/admin/users", label: "Customers", Icon: Users },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin("/admin");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:px-8">
      <nav aria-label="Admin sections" className="lg:w-56 lg:shrink-0">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
          <Boxes className="size-3.5" aria-hidden />
          Admin
        </p>
        <p className="mt-1 truncate text-sm text-muted">{admin.email}</p>

        <ul className="mt-4 flex flex-wrap gap-1 lg:flex-col">
          {NAV.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="inline-flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-surface-alt hover:text-ink"
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
