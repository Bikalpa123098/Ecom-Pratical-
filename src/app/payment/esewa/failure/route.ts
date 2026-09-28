import "server-only";

import { NextResponse } from "next/server";
import { handleEsewaFailureCallback } from "@/server/services/payment";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * eSewa failure / pending callback.
 *
 * The customer is redirected here for a FAILED or PENDING transaction. Reaching
 * this URL does NOT prove the payment failed — a shopper can also land here
 * after a timeout while eSewa has actually taken the money. So the handler
 * always confirms against eSewa's transaction status API before recording a
 * failure, and never marks an order paid on the strength of the URL alone.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order");
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

  if (!orderId) {
    return NextResponse.redirect(
      `${base}/payment/esewa/result?status=error&message=${encodeURIComponent(
        "The payment callback was missing its order reference."
      )}`,
      { status: 303 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true },
  });
  if (!order) {
    return NextResponse.redirect(
      `${base}/payment/esewa/result?status=error&message=${encodeURIComponent(
        "We could not find that order."
      )}`,
      { status: 303 }
    );
  }

  try {
    const outcome = await handleEsewaFailureCallback({
      orderId,
      reason: url.searchParams.get("reason"),
    });

    const params = new URLSearchParams({
      status: outcome.kind,
      order: order.orderNumber,
    });
    if ("reason" in outcome && outcome.reason) params.set("message", outcome.reason);

    return NextResponse.redirect(`${base}/payment/esewa/result?${params.toString()}`, {
      status: 303,
    });
  } catch (err) {
    console.error("[esewa] failure callback failed", {
      orderId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(
      `${base}/payment/esewa/result?status=pending&order=${encodeURIComponent(
        order.orderNumber
      )}&message=${encodeURIComponent(
        "We are still confirming your payment. This page will reflect the outcome shortly."
      )}`,
      { status: 303 }
    );
  }
}
