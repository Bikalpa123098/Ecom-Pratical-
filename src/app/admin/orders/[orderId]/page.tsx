import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  PAYMENT_STATUS_LABELS,
  formatNPR,
  toRupees,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/guards";
import { OrderStatusForm } from "@/components/admin/order-status-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · Order",
  robots: { index: false, follow: false },
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  await requireAdmin(`/admin/orders/${orderId}`);

  // Admin read: not owner-scoped, because support legitimately needs to look up
  // an order a customer quotes on the phone.
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true, user: { select: { id: true, email: true } } },
  });
  if (!order) notFound();

  const status = order.status as OrderStatus;
  const paymentStatus = order.paymentStatus as PaymentStatus;

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="text-sm text-brand-600 hover:underline">
        ← All orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Placed{" "}
            {new Intl.DateTimeFormat("en-NP", { dateStyle: "long", timeStyle: "short" }).format(
              order.createdAt
            )}
            {order.userId && order.user ? (
              <>
                {" · "}
                <a
                  href={`/admin/users?q=${encodeURIComponent(order.user.email)}`}
                  className="hover:underline"
                >
                  {order.user.email}
                </a>
              </>
            ) : (
              " · guest order"
            )}
          </p>
        </div>
        <p className="font-display text-2xl font-semibold text-ink">
          {formatNPR(order.total)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold text-ink">
              Items ({order.items.length})
            </h2>
            <ul className="mt-3 divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-alt">
                    {item.image ? (
                      <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.productName}</p>
                    <p className="text-xs text-muted">
                      {item.productSku} · EU {item.size}
                      {item.colorName ? ` · ${item.colorName}` : ""} · ×{item.quantity}
                    </p>
                    <p className="text-xs text-muted">
                      {formatNPR(item.unitPrice)} each
                      {item.unitMrp > item.unitPrice ? (
                        <span className="ml-1 line-through">{formatNPR(item.unitMrp)}</span>
                      ) : null}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium text-ink">
                    {formatNPR(item.lineTotal)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
              <Row label="Subtotal" value={formatNPR(order.subtotal)} />
              {order.discount > 0 ? (
                <Row label="Discount" value={`-${formatNPR(order.discount)}`} />
              ) : null}
              <Row
                label={`Delivery (${order.district})`}
                value={order.deliveryCharge === 0 ? "Free" : formatNPR(order.deliveryCharge)}
              />
              <Row label="Tax" value={formatNPR(order.taxAmount)} />
              <Row label="Service charge" value={formatNPR(order.serviceCharge)} />
              <div className="flex justify-between border-t border-line pt-2 font-semibold">
                <dt className="text-ink">Total</dt>
                <dd className="text-ink">{formatNPR(order.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold text-ink">Deliver to</h2>
            <address className="mt-2 text-sm not-italic text-muted">
              {order.customerName}
              <br />
              {order.phone} · {order.email}
              <br />
              {order.addressLine}
              <br />
              {order.municipality}
              {order.wardNumber ? `, Ward ${order.wardNumber}` : ""}
              {order.tole ? `, ${order.tole}` : ""}
              <br />
              {order.district}, {order.province}
              {order.postalCode ? ` ${order.postalCode}` : ""}
            </address>
            {order.deliveryNotes ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <span className="font-medium">Customer note:</span> {order.deliveryNotes}
              </p>
            ) : null}
          </section>
        </div>

        <div className="space-y-6">
          <OrderStatusForm
            orderId={order.id}
            currentStatus={status}
            currentPaymentStatus={paymentStatus}
            canCancel={paymentStatus !== "PAID" && status !== "CANCELED"}
          />

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold text-ink">Payment</h2>
            <p className="mt-2 text-xs text-muted">
              {PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus}
            </p>
            {order.payment ? (
              <dl className="mt-3 space-y-1.5 text-sm">
                <Row label="Provider" value={order.payment.provider} />
                <Row label="Record status" value={order.payment.status} />
                <Row label="Gateway status" value={order.payment.gatewayStatus ?? "—"} />
                <div>
                  <dt className="text-muted">Transaction</dt>
                  <dd className="font-mono text-[11px] break-all text-ink">
                    {order.payment.transactionUuid}
                  </dd>
                </div>
                {order.payment.transactionCode ? (
                  <Row label="eSewa reference" value={order.payment.transactionCode} />
                ) : null}
                {order.payment.failureReason ? (
                  <Row label="Failure reason" value={order.payment.failureReason} />
                ) : null}
                {order.paidAt ? (
                  <Row
                    label="Paid at"
                    value={new Intl.DateTimeFormat("en-NP", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(order.paidAt)}
                  />
                ) : null}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted">No payment attempt recorded yet.</p>
            )}
          </section>

          {order.internalNote ? (
            <section className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="text-sm font-semibold text-ink">Internal note</h2>
              <p className="mt-2 text-sm whitespace-pre-wrap text-muted">{order.internalNote}</p>
            </section>
          ) : null}

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold text-ink">Timeline</h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              <TimelineRow label="Created" at={order.createdAt} />
              <TimelineRow label="Paid" at={order.paidAt} />
              <TimelineRow label="Shipped" at={order.shippedAt} />
              <TimelineRow label="Delivered" at={order.deliveredAt} />
              <TimelineRow label="Cancelled" at={order.canceledAt} />
            </ul>
            <p className="mt-3 text-xs text-muted">
              Tax rate applied at checkout:{" "}
              {order.subtotal > 0
                ? toRupees(order.taxAmount) / toRupees(order.subtotal) * 100
                : 0}
              %
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}

function TimelineRow({ label, at }: { label: string; at: Date | null }) {
  return (
    <li className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-ink">
        {at
          ? new Intl.DateTimeFormat("en-NP", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(at)
          : "—"}
      </span>
    </li>
  );
}
