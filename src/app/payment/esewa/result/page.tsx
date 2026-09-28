import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  XCircle,
} from "lucide-react";
import { formatNPR, GUEST_ORDER_COOKIE } from "@/lib/constants";
import { getOrderByNumberForViewer } from "@/server/services/order-queries";

/**
 * eSewa result page.
 *
 * Both callback routes land here with `?status=&order=&message=`. The query
 * parameters only choose the wording; the order row is re-read and authorised
 * (signed-in owner, or the guest cookie) so what the shopper sees is the
 * database's own state. An unrecognised or tampered `status` cannot promote an
 * unpaid order to "paid" here — the copy is chosen from the persisted status.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Payment result",
  robots: { index: false, follow: false },
};

type Tone = "success" | "warning" | "danger" | "neutral";

const COPY: Record<
  Tone,
  { heading: string; body: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    heading: "Payment received",
    body: "Thank you. We have your order and will start preparing it right away.",
    Icon: CheckCircle2,
  },
  warning: {
    heading: "We are confirming your payment",
    body: "eSewa has not confirmed this payment yet. This page is safe to refresh — we will keep checking, and you do not need to pay again.",
    Icon: Clock,
  },
  danger: {
    heading: "Payment was not completed",
    body: "No money has left your account. You can try paying again, or choose another way to pay.",
    Icon: XCircle,
  },
  neutral: {
    heading: "We could not read the payment result",
    body: "We are still checking with eSewa. If you were charged, you will either see the order confirmed or be refunded automatically.",
    Icon: HelpCircle,
  },
};

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined): string | null => {
    const raw = Array.isArray(value) ? value[0] : value;
    return typeof raw === "string" && raw.length > 0 ? raw : null;
  };

  const orderNumber = first(params.order);
  const reportedStatus = first(params.status);
  const message = first(params.message);

  const cookieStore = await cookies();
  const guestToken = cookieStore.get(GUEST_ORDER_COOKIE)?.value ?? null;
  const order = orderNumber
    ? await getOrderByNumberForViewer(orderNumber, guestToken)
    : null;

  // The persisted status is authoritative; the callback's `status` is only a
  // hint, and is used solely when the order could not be read at all.
  const tone = order ? toneForOrder(order.status, order.paymentStatus) : toneForReported(reportedStatus);
  const { heading, body, Icon } = COPY[tone];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm sm:p-10">
        <Icon
          aria-hidden
          className={
            tone === "success"
              ? "mx-auto size-12 text-emerald-600"
              : tone === "danger"
                ? "mx-auto size-12 text-red-600"
                : tone === "warning"
                  ? "mx-auto size-12 text-amber-600"
                  : "mx-auto size-12 text-slate-500"
          }
        />

        <h1 className="mt-5 text-2xl font-semibold text-ink">{heading}</h1>

        {order ? (
          <p className="mt-1 text-sm font-medium text-muted">
            Order {order.orderNumber}
          </p>
        ) : null}

        <p className="mt-3 text-sm text-muted">{body}</p>

        {/*
          Only the messages our own callbacks generate are echoed. They are
          rendered as plain text (React escapes them) and are informative only.
        */}
        {message ? (
          <p className="mt-2 text-xs text-muted/80">{message}</p>
        ) : null}

        {order ? (
          <dl className="mt-6 space-y-1 rounded-xl bg-surface-alt p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Order status</dt>
              <dd className="font-medium text-ink">{order.status.replace(/_/g, " ")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Payment status</dt>
              <dd className="font-medium text-ink">
                {order.paymentStatus.replace(/_/g, " ")}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Total</dt>
              <dd className="font-medium text-ink">{formatNPR(order.total)}</dd>
            </div>
            {order.payment?.transactionCode ? (
              <div className="flex justify-between">
                <dt className="text-muted">eSewa reference</dt>
                <dd className="font-mono text-xs text-ink">
                  {order.payment.transactionCode}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {order && order.paymentStatus !== "PAID" && order.status !== "CANCELED" ? (
            <Link
              href={`/checkout/${order.id}`}
              className="inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Try paying again
            </Link>
          ) : null}
          <Link
            href="/account/orders"
            className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-sm font-semibold text-ink hover:bg-surface-alt"
          >
            View my orders
          </Link>
          <Link
            href="/shop"
            className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-sm font-semibold text-ink hover:bg-surface-alt"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </main>
  );
}

function toneForOrder(status: string, paymentStatus: string): Tone {
  if (status === "CANCELED") return "danger";
  if (paymentStatus === "PAID" || status === "PAID") return "success";
  if (paymentStatus === "REFUNDED") return "neutral";
  if (paymentStatus === "FAILED") return "danger";
  return "warning";
}

function toneForReported(reported: string | null): Tone {
  switch (reported) {
    case "paid":
      return "success";
    case "failed":
      return "danger";
    case "pending":
    case "unverified":
      return "neutral";
    default:
      return "neutral";
  }
}
