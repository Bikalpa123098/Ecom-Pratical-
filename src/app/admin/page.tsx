import "server-only";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { formatNPR, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { requireAdmin } from "@/server/guards";
import { getAdminDashboard } from "@/server/services/admin";
import { reconcilePaymentsAction } from "@/app/actions/admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ reconciled?: string }>;
}) {
  await requireAdmin("/admin");
  const { reconciled } = await searchParams;
  const data = await getAdminDashboard();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>
        <form action={reconcilePaymentsAction}>
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface-alt"
          >
            <RefreshCw className="size-4" aria-hidden />
            Reconcile pending payments
          </button>
        </form>
      </div>

      {reconciled ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Pending payments were re-checked against eSewa. Orders with a confirmed
          payment are now marked paid; the rest are unchanged.
        </p>
      ) : null}

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue (paid orders)" value={formatNPR(data.revenuePaidPaisa)} />
        <Stat label="Orders" value={String(data.ordersTotal)} detail={`${data.ordersPaid} paid`} />
        <Stat
          label="Awaiting payment"
          value={String(data.ordersPending)}
          tone={data.ordersPending > 0 ? "warning" : "neutral"}
        />
        <Stat label="Customers" value={String(data.customers)} />
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Recent orders</h2>
            <Link href="/admin/orders" className="text-xs text-brand-600 hover:underline">
              All orders
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {data.recentOrders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-sm font-medium text-ink hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                  <p className="truncate text-xs text-muted">{order.customerName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium text-ink">{formatNPR(order.total)}</p>
                  <p className="text-xs text-muted">
                    {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                  </p>
                </div>
              </li>
            ))}
            {data.recentOrders.length === 0 ? (
              <li className="py-4 text-sm text-muted">No orders yet.</li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Stock to watch</h2>
          {data.lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Every active size is well stocked.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {data.lowStock.map((row) => (
                <li key={`${row.productId}-${row.size}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${row.slug}`}
                      className="truncate text-sm font-medium text-ink hover:underline"
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-muted">EU {row.size}</p>
                  </div>
                  <p
                    className={`shrink-0 text-sm font-semibold ${
                      row.stock === 0 ? "text-red-700" : "text-amber-700"
                    }`}
                  >
                    {row.stock === 0 ? "Sold out" : `${row.stock} left`}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-6 text-sm font-semibold text-ink">Recent payments</h2>
          <ul className="mt-3 divide-y divide-line">
            {data.recentPayments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{payment.orderNumber}</p>
                  <p className="truncate font-mono text-[11px] text-muted">
                    {payment.transactionCode ?? payment.transactionUuid}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted">
                  {payment.gatewayStatus ?? payment.status}
                </p>
              </li>
            ))}
            {data.recentPayments.length === 0 ? (
              <li className="py-4 text-sm text-muted">No payment attempts yet.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <p className="inline-flex items-center gap-2 text-xs text-muted">
        <AlertTriangle className="size-3.5" aria-hidden />
        {data.productsActive} active products · {data.productsLowStock} sizes low ·{" "}
        {data.outOfStock} sold out
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`mt-1 font-display text-2xl font-semibold ${
          tone === "warning" ? "text-amber-700" : "text-ink"
        }`}
      >
        {value}
      </dd>
      {detail ? <p className="mt-0.5 text-xs text-muted">{detail}</p> : null}
    </div>
  );
}
