import "server-only";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatNPR,
} from "@/lib/constants";
import { requireUser } from "@/server/guards";
import { getOrderByNumberForUser } from "@/server/services/order-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const user = await requireUser(`/account/orders/${orderNumber}`);

  // Owner-scoped: another customer's order number resolves to nothing.
  const order = await getOrderByNumberForUser(orderNumber, user.id);
  if (!order) notFound();

  const payable = order.paymentStatus !== "PAID" && order.status !== "CANCELED";

  return (
    <article>
      <Link
        href="/account/orders"
        className="text-sm text-brand-600 hover:underline"
      >
        ← All orders
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{order.orderNumber}</h2>
          <p className="mt-0.5 text-sm text-muted">
            Placed{" "}
            {new Intl.DateTimeFormat("en-NP", { dateStyle: "long" }).format(
              order.createdAt
            )}
          </p>
        </div>
        {payable ? (
          <Link
            href={`/checkout/${order.id}`}
            className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Pay now
          </Link>
        ) : null}
      </div>

      <ol className="mt-6 flex flex-wrap gap-2 text-xs">
        <Badge>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
        <Badge>{PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}</Badge>
        {order.paidAt ? (
          <Badge>Paid {new Intl.DateTimeFormat("en-NP", { dateStyle: "medium" }).format(order.paidAt)}</Badge>
        ) : null}
      </ol>

      <section className="mt-8">
        <h3 className="text-sm font-semibold text-ink">Items</h3>
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 p-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-surface-alt">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                {item.productSlug ? (
                  <Link
                    href={`/products/${item.productSlug}`}
                    className="text-sm font-medium text-ink hover:underline"
                  >
                    {item.productName}
                  </Link>
                ) : (
                  <p className="text-sm font-medium text-ink">{item.productName}</p>
                )}
                <p className="mt-0.5 text-xs text-muted">
                  {item.productSku}
                  {item.size ? ` · EU ${item.size}` : ""}
                  {item.colorName ? ` · ${item.colorName}` : ""} · ×{item.quantity}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium text-ink">
                {formatNPR(item.lineTotal)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <section className="rounded-xl border border-line p-4">
          <h3 className="text-sm font-semibold text-ink">Delivery address</h3>
          <address className="mt-2 text-sm not-italic text-muted">
            {order.customerName}
            <br />
            {order.addressLine}
            <br />
            {order.municipality}
            {order.wardNumber ? `, Ward ${order.wardNumber}` : ""}
            {order.tole ? `, ${order.tole}` : ""}
            <br />
            {order.district}, {order.province}
            {order.postalCode ? ` ${order.postalCode}` : ""}
            <br />
            {order.phone}
          </address>
          {order.deliveryNotes ? (
            <p className="mt-2 text-xs text-muted">Note: {order.deliveryNotes}</p>
          ) : null}
        </section>

        <section className="rounded-xl border border-line p-4">
          <h3 className="text-sm font-semibold text-ink">Payment</h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="text-ink">{formatNPR(order.subtotal)}</dd>
            </div>
            {order.discount > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted">Discount</dt>
                <dd className="text-emerald-700">-{formatNPR(order.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted">Delivery</dt>
              <dd className="text-ink">
                {order.deliveryCharge === 0 ? "Free" : formatNPR(order.deliveryCharge)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tax &amp; service</dt>
              <dd className="text-ink">
                {formatNPR(order.taxAmount + order.serviceCharge)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-semibold">
              <dt className="text-ink">Total</dt>
              <dd className="text-ink">{formatNPR(order.total)}</dd>
            </div>
            {order.payment?.transactionCode ? (
              <div className="flex justify-between pt-2">
                <dt className="text-muted">eSewa reference</dt>
                <dd className="font-mono text-xs text-ink">
                  {order.payment.transactionCode}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>
    </article>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center rounded-full bg-surface-alt px-2.5 py-0.5 font-medium text-muted">
      {children}
    </li>
  );
}
