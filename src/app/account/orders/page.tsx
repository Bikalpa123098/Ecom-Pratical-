import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatNPR,
} from "@/lib/constants";
import { listUserOrders } from "@/server/services/order-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My orders",
  robots: { index: false, follow: false },
};

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const requested = Number.parseInt(page ?? "1", 10);
  const result = await listUserOrders(
    Number.isFinite(requested) ? requested : 1,
    10
  );

  if (result.orders.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-ink">Orders</h2>
        <div className="mt-4 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="text-sm text-muted">
            You have not placed an order yet.
          </p>
          <Link
            href="/shop"
            className="mt-4 inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Start shopping
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-ink">Orders</h2>
        <p className="text-sm text-muted">
          {result.total} {result.total === 1 ? "order" : "orders"}
        </p>
      </div>

      <ul className="mt-4 space-y-4">
        {result.orders.map((order) => (
          <li key={order.id}>
            <Link
              href={`/account/orders/${order.orderNumber}`}
              className="block rounded-2xl border border-line bg-surface p-4 transition hover:border-brand-500"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{order.orderNumber}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Placed{" "}
                    {new Intl.DateTimeFormat("en-NP", {
                      dateStyle: "medium",
                    }).format(order.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ink">
                    {formatNPR(order.total)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <StatusPill
                  label={ORDER_STATUS_LABELS[order.status] ?? order.status}
                  tone={order.status === "CANCELED" ? "danger" : "neutral"}
                />
                <StatusPill
                  label={PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                  tone={
                    order.paymentStatus === "PAID"
                      ? "success"
                      : order.paymentStatus === "FAILED"
                        ? "danger"
                        : "warning"
                  }
                />
                {/* Unpaid orders keep a direct route back to eSewa. */}
                {order.paymentStatus !== "PAID" && order.status !== "CANCELED" ? (
                  <span className="text-brand-600">Awaiting payment</span>
                ) : null}
              </div>

              <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm text-muted">
                {order.items.map((item, index) => (
                  <li key={`${order.id}-${index}`} className="truncate">
                    {item.productName}
                    {item.size ? ` · EU ${item.size}` : ""} · ×{item.quantity}
                  </li>
                ))}
              </ul>
            </Link>
          </li>
        ))}
      </ul>

      {result.totalPages > 1 ? (
        <nav
          aria-label="Order pages"
          className="mt-6 flex items-center justify-between text-sm"
        >
          {result.page > 1 ? (
            <Link
              href={`/account/orders?page=${result.page - 1}`}
              className="text-brand-600 hover:underline"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {result.page} of {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={`/account/orders?page=${result.page + 1}`}
              className="text-brand-600 hover:underline"
            >
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const tones = {
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
    neutral: "bg-surface-alt text-muted",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium ${tones[tone]}`}
    >
      {label}
    </span>
  );
}
