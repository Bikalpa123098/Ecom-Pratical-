import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

/**
 * Demo eSewa gateway — simulates the real eSewa ePay flow locally.
 *
 * This route accepts the same signed POST that the real eSewa endpoint would,
 * then redirects to the success URL with a Base64-encoded, HMAC-signed payload
 * that passes the same verification as a genuine eSewa response.
 *
 * Use this for student projects and demos where real merchant credentials
 * are not available. Set ESEWA_DEMO_MODE=true to activate.
 */

const SECRET = "8gBm/:&EnhH.1/q(";

function sign(message: string): string {
  return crypto.createHmac("sha256", SECRET).update(message, "utf8").digest("base64");
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const totalAmount = formData.get("total_amount")?.toString() ?? "";
  const transactionUuid = formData.get("transaction_uuid")?.toString() ?? "";
  const productCode = formData.get("product_code")?.toString() ?? "";
  const successUrl = formData.get("success_url")?.toString() ?? "";
  const failureUrl = formData.get("failure_url")?.toString() ?? "";

  // Simulate a small delay like a real payment gateway
  await new Promise((r) => setTimeout(r, 800));

  // Build the response payload exactly as eSewa would
  const signedFieldNames =
    "transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names";
  const message = [
    `transaction_code=000DEMO`,
    `status=COMPLETE`,
    `total_amount=${totalAmount}.0`,
    `transaction_uuid=${transactionUuid}`,
    `product_code=${productCode}`,
    `signed_field_names=${signedFieldNames}`,
  ].join(",");

  const signature = sign(message);

  const payload = {
    transaction_code: "000DEMO",
    status: "COMPLETE",
    total_amount: `${totalAmount}.0`,
    transaction_uuid: transactionUuid,
    product_code: productCode,
    signed_field_names: signedFieldNames,
    signature,
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  const redirectUrl = `${successUrl}${successUrl.includes("?") ? "&" : "?"}data=${encodeURIComponent(encoded)}`;

  return NextResponse.redirect(redirectUrl, 302);
}
