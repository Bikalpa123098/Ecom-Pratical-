import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  formatNPR,
} from "@/lib/constants";
import { requireAdmin } from "@/server/guards";
import { listAdminOrders } from "@/server/services/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · Orders",
  robots: { index: false, follow: false },
};

const PER_PAGE = 20;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    payment?: string;
    q?: string;
  }>;
}) {
  await requireAdmin("/admin/orders");
  const params = await searchParams;

  const requested = Number.parseInt(params.page ?? "1", 10);
  const result = await listAdminOrders({
    page: Number.isFinite(requested) ? requested : 1,
    status: params.status,
    paymentStatus: params.payment,
    q: params.q?.trim() || undefined,
    perPage: PER_PAGE,
  });

  // Preserves the active filters in every pagination and filter link.
  const href = (overrides: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { status: params.status, payment: params.payment, q: params.q, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) search.set(key, value);
    }
    const query = search.toString();
    return query ? `/admin/orders?${query}` : "/admin/orders";
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Orders</h1>

      <form action="/admin/orders" className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="block text-xs text-muted">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Order number, name or phone"
            className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-xs text-muted">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={params.status ?? ""}
            className="mt-1 h-10 rounded-lg border border-line bg-surface px-3 text-sm"
          >
            <option value="">All</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="payment" className="block text-xs text-muted">
            Payment
          </label>
          <select
            id="payment"
            name="payment"
            defaultValue={params.payment ?? ""}
            className="mt-1 h-10 rounded-lg border border-line bg-surface px-3 text-sm"
          >
            <option value="">All</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PAYMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Filter
        </button>
      </form>

      {result.orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
          No orders match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-3xl text-sm">
            <thead className="bg-surface-alt text-left text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Order</th>
                <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                <th scope="col" className="px-4 py-3 font-medium">District</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Payment</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.orders.map((order) => (
                <tr key={order.id} className="bg-surface">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-muted">
                      {new Intl.DateTimeFormat("en-NP", { dateStyle: "medium" }).format(
                        order.createdAt
                      )}
                      {" · "}
                      {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-ink">{order.customerName}</p>
                    <p className="text-xs text-muted">{order.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{order.district}</td>
                  <td className="px-4 py-3">
                    <Pill label={ORDER_STATUS_LABELS[order.status] ?? order.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      label={PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                      tone={
                        order.paymentStatus === "PAID"
                          ? "success"
                          : order.paymentStatus === "FAILED"
                            ? "danger"
                            : "neutral"
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-ink">
                    {formatNPR(order.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.totalPages > 1 ? (
        <nav aria-label="Order pages" className="flex items-center justify-between text-sm">
          {result.page > 1 ? (
            <Link href={href({ page: String(result.page - 1) })} className="text-brand-600 hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {result.page} of {result.totalPages} · {result.total} orders
          </span>
          {result.page < result.totalPages ? (
            <Link href={href({ page: String(result.page + 1) })} className="text-brand-600 hover:underline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "success" | "danger" | "neutral";
}) {
  const tones = {
    success: "bg-emerald-50 text-emerald-700",
    danger: "bg-red-50 text-red-700",
    neutral: "bg-surface-alt text-muted",
  } as const;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {label}
    </span>
  );
}
