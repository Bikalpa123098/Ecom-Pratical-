import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { formatNPR, GUEST_ORDER_COOKIE } from "@/lib/constants";
import { isEsewaConfigured } from "@/lib/payments/esewa";
import { prepareEsewaPayment } from "@/server/services/payment";
import { getOrderForViewer, type OrderDetail } from "@/server/services/order-queries";
import { EsewaAutoSubmit } from "@/components/payment/esewa-auto-submit";

/**
 * Payment handoff page.
 *
 * Reached straight after checkout. The order is authorised here (signed-in owner
 * or the guest cookie), the signed eSewa form is rebuilt from the persisted order
 * so a refresh cannot create a second payment, and the form auto-posts to
 * eSewa. Nothing about the amount comes from the browser.
 *
 * A refresh re-uses the same transaction UUID, so eSewa treats it as the same
 * attempt rather than a second charge.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Redirecting to eSewa",
  robots: { index: false, follow: false },
};

export default async function CheckoutHandoffPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const cookieStore = await cookies();
  const guestToken = cookieStore.get(GUEST_ORDER_COOKIE)?.value ?? null;

  const order = await getOrderForViewer(orderId, guestToken);
  // A guest without the matching cookie lands on 404 rather than learning that
  // the order exists.
  if (!order) notFound();

  const alreadyPaid = order.status === "PAID" || order.paymentStatus === "PAID";
  const cancelled = order.status === "CANCELED";

  let checkout = null;
  let paymentProblem: string | null = null;

  if (alreadyPaid || cancelled) {
    paymentProblem = alreadyPaid
      ? "This order has already been paid — no need to pay again."
      : "This order was cancelled, so it can no longer be paid.";
  } else if (!isEsewaConfigured()) {
    // No secret means no request can be signed. The order stays
    // PENDING_PAYMENT with its stock reserved and reconciliation picks it up
    // once the gateway is configured; we say so rather than pretend to pay.
    paymentProblem =
      "Online payment is not available at the moment. Your order is saved and we will email you as soon as payment opens, or you can contact us to pay another way.";
  } else {
    try {
      checkout = await prepareEsewaPayment(order.id);
    } catch (err) {
      // A payment that cannot be prepared is reported plainly; the order and
      // its reservation are untouched, so a retry is safe.
      console.error("[checkout] could not prepare payment", {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      });
      paymentProblem =
        "We could not start your payment. Your order is saved — please try again in a moment.";
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          Order {order.orderNumber}
        </p>

        {checkout ? (
          <>
            <h1 className="mt-2 text-2xl font-semibold text-ink">
              Taking you to eSewa
            </h1>
            <p className="mt-2 text-sm text-muted">
              You will be returned to {formatNPR(checkout.totalAmountPaisa)} once
              eSewa confirms the payment. Please do not close or refresh this
              window.
            </p>

            {/*
              The signed form is posted from the browser because eSewa's
              signature covers the request body; a server-side redirect cannot
              carry it. `submitted` flips to disable the button in case the
              auto-submit is blocked.
            */}
            <form
              action={checkout.formUrl}
              method="post"
              name="esewa-checkout"
              className="mt-6"
            >
              {checkout.fields.map((field) => (
                <input
                  key={field.name}
                  type="hidden"
                  name={field.name}
                  value={field.value}
                />
              ))}
              <button
                type="submit"
                className="inline-flex h-11 items-center rounded-lg bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Pay {formatNPR(checkout.totalAmountPaisa)} with eSewa
              </button>
            </form>

            <EsewaAutoSubmit formName="esewa-checkout" />
          </>
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-semibold text-ink">
              {alreadyPaid ? "Payment received" : "We could not take your payment"}
            </h1>
            <p className="mt-2 text-sm text-muted">{paymentProblem}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {!alreadyPaid && !cancelled ? (
                <Link
                  href={`/checkout/${order.id}`}
                  className="inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Try again
                </Link>
              ) : null}
              <Link
                href="/shop"
                className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-sm font-semibold text-ink hover:bg-surface-alt"
              >
                Continue shopping
              </Link>
            </div>
          </>
        )}

        <OrderSummary order={order} />
      </div>
    </main>
  );
}

/**
 * Submits the signed form as soon as it mounts. eSewa's endpoint is a page that
 * only accepts a POST, so this has to happen in the browser.
 */
function OrderSummary({ order }: { order: OrderDetail }) {
  return (
    <section className="mt-8 border-t border-line pt-6">
      <h2 className="text-sm font-semibold text-ink">Order summary</h2>
      <ul className="mt-3 space-y-2">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4 text-sm">
            <span className="text-muted">
              {item.productName}
              {item.size ? ` · EU ${item.size}` : ""} · ×{item.quantity}
            </span>
            <span className="shrink-0 font-medium text-ink">
              {formatNPR(item.lineTotal)}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd className="font-medium text-ink">{formatNPR(order.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Delivery to {order.district}</dt>
          <dd className="font-medium text-ink">
            {order.deliveryCharge === 0 ? "Free" : formatNPR(order.deliveryCharge)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Tax &amp; service</dt>
          <dd className="font-medium text-ink">
            {formatNPR(order.taxAmount + order.serviceCharge)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-base">
          <dt className="font-semibold text-ink">Total</dt>
          <dd className="font-semibold text-ink">{formatNPR(order.total)}</dd>
        </div>
      </dl>
    </section>
  );
}
