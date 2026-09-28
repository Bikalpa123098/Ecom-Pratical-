import "server-only";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { buildTransactionUuid, type EsewaTransactionStatus } from "@/lib/constants";
import {
  buildEsewaCallbackUrls,
  buildEsewaCheckout,
  checkEsewaTransactionStatus,
  EsewaVerificationError,
  getEsewaConfig,
  verifyEsewaCallback,
  type BuiltEsewaCheckout,
} from "@/lib/payments/esewa";
import { releaseOrderStock } from "@/server/services/order";

/**
 * Payment orchestration.
 *
 * The only two functions that may move an order to PAID are
 * `markOrderPaidFromVerifiedCallback` and `markOrderPaidFromStatusCheck`, and
 * both require a cryptographically verified payload first. No code path trusts
 * a status or amount that arrived in a URL or request body.
 */

export class PaymentError extends Error {
  override name = "PaymentError";
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
  }
}

/**
 * Prepares (or re-prepares) the eSewa checkout for an order.
 *
 * A transaction_uuid is generated per payment attempt. The order is left in
 * PENDING_PAYMENT and no stock is touched here — stock was reserved when the
 * order was created.
 */
export async function prepareEsewaPayment(
  orderId: string
): Promise<BuiltEsewaCheckout> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!order) throw new PaymentError("Order not found.", "ORDER_NOT_FOUND");

  if (order.status === "PAID" || order.paymentStatus === "PAID") {
    throw new PaymentError("This order has already been paid.", "ALREADY_PAID");
  }
  if (order.status === "CANCELED") {
    throw new PaymentError("This order was cancelled.", "ORDER_CANCELED");
  }

  // Reuse the existing attempt so a refresh of the checkout page does not
  // create a second payment record for one order.
  //
  // `amount` on the payment row is the order TOTAL (subtotal + delivery + tax),
  // whereas eSewa's `amount` field is the goods subtotal only. Rebuilding from
  // `order.subtotal` keeps the decomposition identical to the first attempt; the
  // same transaction UUID is reused so eSewa treats the retry as idempotent
  // rather than as a second payment.
  if (order.payment && order.payment.status === "PENDING") {
    const existing = buildEsewaCheckout({
      amountPaisa: order.subtotal,
      taxAmountPaisa: order.taxAmount,
      serviceChargePaisa: order.serviceCharge,
      deliveryChargePaisa: order.deliveryCharge,
      transactionUuid: order.payment.transactionUuid,
      ...buildEsewaCallbackUrls(env.NEXT_PUBLIC_APP_URL, order.id),
    });

    // Defence in depth: the persisted total must still match what we are about
    // to sign. If a partial update ever left them inconsistent, refuse rather
    // than send a request eSewa would reject.
    if (existing.totalAmountPaisa !== order.total) {
      throw new PaymentError(
        "Your order total could not be verified. Please contact us before paying.",
        "TOTAL_MISMATCH"
      );
    }

    return existing;
  }

  const transactionUuid = buildTransactionUuid("BKL", new Date(), randomNonce());
  const { successUrl, failureUrl } = buildEsewaCallbackUrls(
    env.NEXT_PUBLIC_APP_URL,
    order.id
  );

  // amount excludes tax/service/delivery, matching eSewa's decomposition.
  const amountPaisa = order.subtotal;

  const checkout = buildEsewaCheckout({
    amountPaisa,
    taxAmountPaisa: order.taxAmount,
    serviceChargePaisa: order.serviceCharge,
    deliveryChargePaisa: order.deliveryCharge,
    transactionUuid,
    successUrl,
    failureUrl,
  });

  const config = getEsewaConfig();

  if (order.payment) {
    await prisma.payment.update({
      where: { orderId: order.id },
      data: {
        transactionUuid,
        amount: order.total,
        status: "PENDING",
        gatewayStatus: null,
        requestSignature: checkout.signature,
        signedFieldNames: checkout.fields.find((f) => f.name === "signed_field_names")?.value,
        environment: config.mode === "production" ? "PRODUCTION" : "TEST",
        failureReason: null,
        verifiedAt: null,
        paidAt: null,
      },
    });
  } else {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        transactionUuid,
        amount: order.total,
        status: "PENDING",
        requestSignature: checkout.signature,
        signedFieldNames: checkout.fields.find((f) => f.name === "signed_field_names")?.value,
        environment: config.mode === "production" ? "PRODUCTION" : "TEST",
      },
    });
  }

  return checkout;
}

function randomNonce(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("")
    .slice(0, 12)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");
}

export type CallbackOutcome =
  | { kind: "paid"; alreadyProcessed: boolean; transactionCode: string | null }
  | { kind: "pending"; reason: string }
  | { kind: "failed"; reason: string }
  | { kind: "refunded"; reason: string }
  | { kind: "unverified"; reason: string };

/**
 * Handles eSewa's redirect to success_url.
 *
 * Verifies the response signature, binds it to the order, and only then updates
 * state. Re-entry is safe: an order already marked PAID short-circuits.
 */
export async function handleEsewaSuccessCallback(params: {
  orderId: string;
  data: string | null;
}): Promise<CallbackOutcome> {
  const { orderId } = params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!order) throw new PaymentError("Order not found.", "ORDER_NOT_FOUND");
  if (!order.payment) {
    throw new PaymentError("This order has no payment record.", "NO_PAYMENT");
  }

  // Idempotent: eSewa or the shopper may replay the callback.
  if (order.paymentStatus === "PAID" || order.status === "PAID") {
    return { kind: "paid", alreadyProcessed: true, transactionCode: order.payment.transactionCode };
  }

  if (!params.data) {
    // No payload: fall back to the status API rather than guessing.
    return reconcileFromStatusApi(orderId, "eSewa returned no payment data.");
  }

  let verified;
  try {
    verified = verifyEsewaCallback({
      dataParam: params.data,
      expectedTransactionUuid: order.payment.transactionUuid,
      expectedProductCode: order.payment.environment === "PRODUCTION"
        ? (env.ESEWA_MERCHANT_CODE ?? "")
        : (env.ESEWA_MERCHANT_CODE ?? ""),
      expectedTotalAmountPaisa: order.total,
    });
  } catch (err) {
    const reason =
      err instanceof EsewaVerificationError
        ? `${err.reason}: ${err.message}`
        : "Response verification failed.";
    await prisma.payment.update({
      where: { orderId },
      data: { failureReason: reason, responsePayload: truncate(params.data) },
    });
    return { kind: "unverified", reason };
  }

  await prisma.payment.update({
    where: { orderId },
    data: {
      responsePayload: truncate(params.data),
      gatewayStatus: verified.status,
    },
  });

  switch (verified.status) {
    case "COMPLETE":
      await markOrderPaidFromVerifiedCallback(orderId, verified.transactionCode);
      return { kind: "paid", alreadyProcessed: false, transactionCode: verified.transactionCode };

    case "PENDING":
      return { kind: "pending", reason: "eSewa reports the payment is still pending." };

    case "AMBIGUOUS":
      // Do not guess. Re-query eSewa's status API.
      return reconcileFromStatusApi(orderId, "eSewa reported an ambiguous result.");

    case "FULL_REFUND":
    case "PARTIAL_REFUND":
      await markOrderRefunded(orderId, verified.status);
      return { kind: "refunded", reason: `eSewa reports ${verified.status}.` };

    case "CANCELED":
    case "NOT_FOUND":
      await markOrderPaymentFailed(orderId, `eSewa reports ${verified.status}.`);
      return { kind: "failed", reason: `eSewa reports ${verified.status}.` };

    default:
      return { kind: "unverified", reason: `Unrecognised eSewa status "${verified.status}".` };
  }
}

/**
 * Promotes an order to PAID. Callable only after verification; performs a
 * conditional update so a concurrent callback cannot double-apply.
 */
async function markOrderPaidFromVerifiedCallback(
  orderId: string,
  transactionCode: string | null
): Promise<void> {
  const now = new Date();

  const claimed = await prisma.order.updateMany({
    where: {
      id: orderId,
      paymentStatus: { in: ["PENDING", "AMBIGUOUS", "FAILED"] },
    },
    data: {
      status: "PAID",
      paymentStatus: "PAID",
      paidAt: now,
    },
  });

  if (claimed.count === 0) {
    // Another request already claimed it.
    return;
  }

  await prisma.payment.update({
    where: { orderId },
    data: {
      status: "COMPLETE",
      gatewayStatus: "COMPLETE",
      transactionCode,
      verifiedAt: now,
      paidAt: now,
      failureReason: null,
      lastCheckedAt: now,
    },
  });

  // First confirmed sale: record the units sold for "best selling" sorting.
  const items = await prisma.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (!item.productId) continue;
    await prisma.product.updateMany({
      where: { id: item.productId },
      data: { soldCount: { increment: item.quantity } },
    });
  }
}

async function markOrderRefunded(orderId: string, gatewayStatus: string): Promise<void> {
  await prisma.order.updateMany({
    where: { id: orderId },
    data: {
      status: "REFUNDED",
      paymentStatus: gatewayStatus === "PARTIAL_REFUND" ? "PARTIALLY_REFUNDED" : "REFUNDED",
    },
  });
  await prisma.payment.update({
    where: { orderId },
    data: { status: gatewayStatus, gatewayStatus, lastCheckedAt: new Date() },
  });
}

async function markOrderPaymentFailed(orderId: string, reason: string): Promise<void> {
  await prisma.order.updateMany({
    where: { id: orderId, status: "PENDING_PAYMENT" },
    data: { status: "PAYMENT_FAILED", paymentStatus: "FAILED" },
  });
  await prisma.payment.update({
    where: { orderId },
    data: {
      status: gatewayStatusToRecord(reason),
      gatewayStatus: reason,
      failureReason: reason,
      lastCheckedAt: new Date(),
    },
  });
  await releaseOrderStock(orderId);
}

function gatewayStatusToRecord(reason: string): string {
  if (reason.includes("CANCELED")) return "CANCELED";
  if (reason.includes("NOT_FOUND")) return "NOT_FOUND";
  return "FAILED";
}

/**
 * Fallback path used when a callback is missing or AMBIGUOUS: ask eSewa
 * directly. This is also the reconciliation entry point for the admin panel.
 */
export async function reconcileFromStatusApi(
  orderId: string,
  note: string
): Promise<CallbackOutcome> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!order?.payment) {
    throw new PaymentError("Order has no payment record.", "NO_PAYMENT");
  }
  if (order.paymentStatus === "PAID") {
    return { kind: "paid", alreadyProcessed: true, transactionCode: order.payment.transactionCode };
  }

  const result = await checkEsewaTransactionStatus({
    transactionUuid: order.payment.transactionUuid,
    totalAmountPaisa: order.total,
  });

  await prisma.payment.update({
    where: { orderId },
    data: {
      statusChecks: { increment: 1 },
      lastCheckedAt: new Date(),
      gatewayStatus: result.rawStatus,
      failureReason: result.errorMessage ?? note,
    },
  });

  // Cross-check the status response against our own order before trusting it.
  if (result.transactionUuid && result.transactionUuid !== order.payment.transactionUuid) {
    return { kind: "unverified", reason: "Status response did not match our transaction." };
  }
  if (result.productCode && result.productCode !== (env.ESEWA_MERCHANT_CODE ?? "")) {
    return { kind: "unverified", reason: "Status response product code mismatch." };
  }
  if (result.totalAmount !== null) {
    const receivedPaisa = Math.round(result.totalAmount * 100);
    if (receivedPaisa !== order.total) {
      return {
        kind: "unverified",
        reason: `Status response amount mismatch: expected ${order.total}, received ${receivedPaisa} paisa.`,
      };
    }
  }

  const status: EsewaTransactionStatus | "UNKNOWN" = result.status;

  switch (status) {
    case "COMPLETE":
      await markOrderPaidFromVerifiedCallback(orderId, result.refId);
      return { kind: "paid", alreadyProcessed: false, transactionCode: result.refId };

    case "PENDING":
      return { kind: "pending", reason: "eSewa still reports this payment as pending." };

    case "AMBIGUOUS":
      return { kind: "pending", reason: "eSewa cannot yet confirm this payment." };

    case "FULL_REFUND":
    case "PARTIAL_REFUND":
      await markOrderRefunded(orderId, status);
      return { kind: "refunded", reason: `eSewa reports ${status}.` };

    case "CANCELED":
    case "NOT_FOUND":
      await markOrderPaymentFailed(orderId, `eSewa reports ${status}.`);
      return { kind: "failed", reason: `eSewa reports ${status}.` };

    default:
      if (result.serviceUnavailable) {
        return {
          kind: "pending",
          reason: "eSewa's status service is temporarily unavailable. We will keep checking.",
        };
      }
      return { kind: "unverified", reason: result.errorMessage ?? note };
  }
}

function truncate(value: string, max = 4000): string {
  return value.length > max ? `${value.slice(0, max)}...[truncated]` : value;
}

/** Handles eSewa's redirect to failure_url. Never marks an order paid. */
export async function handleEsewaFailureCallback(params: {
  orderId: string;
  reason?: string | null;
}): Promise<CallbackOutcome> {
  const { orderId } = params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!order) throw new PaymentError("Order not found.", "ORDER_NOT_FOUND");

  if (order.paymentStatus === "PAID") {
    return { kind: "paid", alreadyProcessed: true, transactionCode: order.payment?.transactionCode ?? null };
  }

  // A customer who abandons the payment may still have paid moments later, so
  // confirm with the status API before declaring failure.
  const reconciled = await reconcileFromStatusApi(
    orderId,
    params.reason ?? "Customer reached the failure URL."
  );
  if (reconciled.kind === "paid") return reconciled;

  return {
    kind: "failed",
    reason: params.reason ?? "The payment was not completed.",
  };
}

/** Background/ondemand reconciliation for orders stuck in a pending state. */
export async function reconcileStuckOrders(limit = 25): Promise<{
  checked: number;
  paid: number;
  failed: number;
}> {
  const stuck = await prisma.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      paymentStatus: { in: ["PENDING", "AMBIGUOUS", "FAILED"] },
      createdAt: { lt: new Date(Date.now() - 2 * 60 * 1000) },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let paid = 0;
  let failed = 0;
  for (const order of stuck) {
    try {
      const outcome = await reconcileFromStatusApi(order.id, "Scheduled reconciliation.");
      if (outcome.kind === "paid") paid += 1;
      if (outcome.kind === "failed") failed += 1;
    } catch {
      // A single unreachable order must not abort the sweep.
    }
  }
  return { checked: stuck.length, paid, failed };
}
