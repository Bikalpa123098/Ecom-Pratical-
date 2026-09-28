import "server-only";

import { NextResponse } from "next/server";
import { handleEsewaSuccessCallback } from "@/server/services/payment";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * eSewa success callback.
 *
 * eSewa redirects the customer here with the response parameters Base64-encoded
 * in the `data` query parameter. The signature is verified before the order is
 * touched, then the customer is forwarded to a normal page that renders the
 * outcome. This handler never renders anything itself and never trusts a status
 * from the URL.
 *
 * Accepts GET (eSewa's documented redirect) and POST, because the failure path
 * of some gateway versions submits a form.
 */

export const dynamic = "force-dynamic";
// eSewa is a third party; never cache this response.
export const revalidate = 0;

async function readFormData(request: Request): Promise<string | null> {
  try {
    const form = await request.formData();
    const value = form.get("data");
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  return handle(request, null);
}

export async function POST(request: Request) {
  const formData = await readFormData(request);
  return handle(request, formData);
}

async function handle(request: Request, postedData: string | null) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order");
  const data = postedData ?? url.searchParams.get("data");

  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

  if (!orderId) {
    return NextResponse.redirect(
      `${base}/payment/esewa/result?status=error&message=${encodeURIComponent(
        "The payment callback was missing its order reference."
      )}`,
      { status: 303 }
    );
  }

  // Confirm the order exists before doing anything else, so a bogus id does
  // not reach the payment service.
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, orderNumber: true },
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
    const outcome = await handleEsewaSuccessCallback({ orderId, data });

    const params = new URLSearchParams({
      status: outcome.kind,
      order: order.orderNumber,
    });
    if (outcome.kind === "unverified") {
      params.set("message", outcome.reason);
    }
    if (outcome.kind === "pending") {
      params.set("message", outcome.reason);
    }
    if (outcome.kind === "failed") {
      params.set("message", outcome.reason);
    }
    if (outcome.kind === "refunded") {
      params.set("message", outcome.reason);
    }

    return NextResponse.redirect(`${base}/payment/esewa/result?${params.toString()}`, {
      status: 303,
    });
  } catch (err) {
    // Never leak internal detail to the browser; the order stays pending and
    // reconciliation will retry against eSewa's status API.
    console.error("[esewa] success callback failed", {
      orderId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(
      `${base}/payment/esewa/result?status=unverified&order=${encodeURIComponent(
        order.orderNumber
      )}&message=${encodeURIComponent(
        "We could not confirm your payment yet. If you were charged, you will be refunded or the order confirmed automatically within a few minutes."
      )}`,
      { status: 303 }
    );
  }
}
