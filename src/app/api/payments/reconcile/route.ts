import "server-only";

import { NextResponse } from "next/server";
import { assertAdmin } from "@/server/guards";
import { reconcileFromStatusApi, reconcileStuckOrders } from "@/server/services/payment";

/**
 * On-demand reconciliation against eSewa's transaction status API.
 *
 * Admin-only. Used when a callback was lost, an order sits in AMBIGUOUS, or
 * support needs to confirm a payment manually. This is a read against eSewa
 * plus a conditional write — it never trusts client-supplied status or amount.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { orderId?: string; sweep?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // An empty body is treated as a sweep request.
  }

  try {
    if (body.orderId) {
      const outcome = await reconcileFromStatusApi(
        body.orderId,
        "Manual reconciliation from the admin dashboard."
      );
      return NextResponse.json({ ok: true, outcome });
    }

    const sweep = await reconcileStuckOrders();
    return NextResponse.json({ ok: true, sweep });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reconciliation failed." },
      { status: 500 }
    );
  }
}
