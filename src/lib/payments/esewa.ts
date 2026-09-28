import "server-only";

import crypto from "node:crypto";
import { env } from "@/lib/env";
import {
  assertValidTransactionUuid,
  paisaToEsewaAmount,
  type EsewaTransactionStatus,
} from "@/lib/constants";

/**
 * eSewa ePay (v2) integration.
 *
 * Reference: https://developer.esewa.com.np/pages/Epay
 *
 *  - Checkout is a browser POST of a signed form to
 *    `https://rc-epay.esewa.com.np/api/epay/main/v2/form` (test) or
 *    `https://epay.esewa.com.np/api/epay/main/v2/form` (production).
 *  - All eleven data parameters are mandatory and must be non-empty; unused
 *    tax/service/delivery charges must be sent as "0".
 *  - `total_amount = amount + tax_amount + product_service_charge
 *                    + product_delivery_charge`
 *  - The signature is an HMAC-SHA256 over the fields named in
 *    `signed_field_names`, in that exact order, formatted `name=value` and
 *    joined with commas, Base64-encoded.
 *  - On success eSewa redirects to `success_url` with the response parameters
 *    Base64-encoded in the `data` query parameter. Integrity MUST be verified
 *    by regenerating the signature from the returned `signed_field_names`
 *    before the payment is trusted.
 *  - When no response arrives, the transaction status API is queried with
 *    product_code + transaction_uuid + total_amount.
 *
 * SECURITY: this module is server-only. The signing secret never leaves the
 * server, and no function here may be called from a client component.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Endpoints exactly as published in the document. Note the document uses two
 * different test hosts — `rc-epay.esewa.com.np` for the form endpoint and
 * `rc.esewa.com.np` for the status API — so both are reproduced literally here
 * rather than normalised. Each is overridable by environment variable.
 */
const ENDPOINTS = {
  test: {
    formUrl: "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
    statusUrl: "https://rc.esewa.com.np/api/epay/transaction/status/",
  },
  production: {
    formUrl: "https://epay.esewa.com.np/api/epay/main/v2/form",
    statusUrl: "https://esewa.com.np/api/epay/transaction/status/",
  },
} as const;

export type EsewaMode = keyof typeof ENDPOINTS;

export interface EsewaConfig {
  mode: EsewaMode;
  productCode: string;
  secretKey: string;
  formUrl: string;
  statusUrl: string;
  demoMode: boolean;
}

export class EsewaConfigError extends Error {
  override name = "EsewaConfigError";
}

export function isEsewaConfigured(): boolean {
  return Boolean(env.ESEWA_MERCHANT_CODE && env.ESEWA_SECRET_KEY);
}

/**
 * Resolves the active eSewa configuration, deriving endpoints from
 * ESEWA_MODE. Throws a descriptive error rather than silently degrading, so a
 * misconfigured deployment fails loudly instead of producing unpaid orders.
 */
export function getEsewaConfig(): EsewaConfig {
  const mode: EsewaMode = env.ESEWA_MODE === "production" ? "production" : "test";
  const productCode = env.ESEWA_MERCHANT_CODE?.trim() ?? "";
  const secretKey = env.ESEWA_SECRET_KEY?.trim() ?? "";
  const demoMode = env.ESEWA_DEMO_MODE === "true";

  if (!productCode) {
    throw new EsewaConfigError(
      "eSewa is not configured: ESEWA_MERCHANT_CODE is empty. " +
        "Use 'EPAYTEST' for the test gateway."
    );
  }
  if (!secretKey) {
    throw new EsewaConfigError(
      "eSewa is not configured: ESEWA_SECRET_KEY is empty. " +
        "This is the HMAC signing key issued by eSewa and must never be committed."
    );
  }
  if (mode === "production" && productCode === "EPAYTEST") {
    throw new EsewaConfigError(
      "Refusing to run production payments with the EPAYTEST merchant code. " +
        "Set ESEWA_MERCHANT_CODE to your live eSewa merchant code."
    );
  }

  const defaults = ENDPOINTS[mode];
  return {
    mode,
    productCode,
    secretKey,
    demoMode,
    formUrl: demoMode
      ? `${env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/payments/esewa-demo`
      : (env.ESEWA_FORM_URL ?? defaults.formUrl),
    statusUrl: env.ESEWA_STATUS_URL ?? defaults.statusUrl,
  };
}

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

/**
 * Builds the exact string eSewa signs.
 *
 * For `signed_field_names = "total_amount,transaction_uuid,product_code"` and
 * the values `110`, `241028`, `EPAYTEST` this produces:
 *
 *   total_amount=110,transaction_uuid=241028,product_code=EPAYTEST
 *
 * Values are used verbatim, in the order given by `signed_field_names`; no
 * reformatting, sorting or trimming is applied.
 */
export function buildSignatureMessage(
  signedFieldNames: string,
  values: Record<string, string>
): string {
  const names = signedFieldNames
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  if (names.length === 0) {
    throw new EsewaError("signed_field_names must name at least one field");
  }

  return names
    .map((name) => {
      const value = values[name];
      if (value === undefined) {
        throw new EsewaError(
          `signed_field_names references "${name}" but no value was supplied`
        );
      }
      return `${name}=${value}`;
    })
    .join(",");
}

/** HMAC-SHA256 of the signature message, Base64 encoded. */
export function signMessage(message: string, secretKey: string): string {
  if (!secretKey) throw new EsewaConfigError("Cannot sign: eSewa secret key is empty");
  return crypto.createHmac("sha256", secretKey).update(message, "utf8").digest("base64");
}

/** Convenience wrapper: builds the message then signs it. */
export function generateSignature(
  signedFieldNames: string,
  values: Record<string, string>,
  secretKey: string
): string {
  return signMessage(buildSignatureMessage(signedFieldNames, values), secretKey);
}

/** Length-safe, timing-safe comparison of two Base64 signatures. */
export function signaturesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class EsewaError extends Error {
  override name = "EsewaError";
  constructor(message: string) {
    super(message);
  }
}

export class EsewaVerificationError extends Error {
  override name = "EsewaVerificationError";
  constructor(
    message: string,
    readonly reason: string
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Checkout request
// ---------------------------------------------------------------------------

/** Every data parameter required by the eSewa checkout form. */
export interface EsewaCheckoutParams {
  /** Product subtotal in paisa (excludes tax, service and delivery charge). */
  amountPaisa: number;
  taxAmountPaisa?: number;
  serviceChargePaisa?: number;
  deliveryChargePaisa?: number;
  transactionUuid: string;
  /** Absolute, server-derived. Never accepted from client input. */
  successUrl: string;
  /** Absolute, server-derived. Never accepted from client input. */
  failureUrl: string;
}

export interface EsewaFormField {
  name: EsewaFieldName;
  value: string;
}

export type EsewaFieldName =
  | "amount"
  | "tax_amount"
  | "product_service_charge"
  | "product_delivery_charge"
  | "total_amount"
  | "transaction_uuid"
  | "product_code"
  | "signed_field_names"
  | "signature"
  | "success_url"
  | "failure_url";

/**
 * The fields covered by the request signature, in the order the document's own
 * example uses.
 */
export const ESEWA_SIGNED_FIELD_NAMES =
  "total_amount,transaction_uuid,product_code" as const;

export interface BuiltEsewaCheckout {
  formUrl: string;
  fields: EsewaFormField[];
  /** Field name -> signed value, for persisting the audit trail. */
  signedValues: Record<string, string>;
  signature: string;
  totalAmountPaisa: number;
  transactionUuid: string;
  productCode: string;
}

/**
 * Builds the complete signed checkout form POST for eSewa.
 *
 * Enforces the document's arithmetic identity before signing, so an internally
 * inconsistent order can never be sent to the gateway.
 */
export function buildEsewaCheckout(params: EsewaCheckoutParams): BuiltEsewaCheckout {
  const config = getEsewaConfig();

  const amount = paisaToEsewaAmount(params.amountPaisa);
  const tax = paisaToEsewaAmount(params.taxAmountPaisa ?? 0);
  const service = paisaToEsewaAmount(params.serviceChargePaisa ?? 0);
  const delivery = paisaToEsewaAmount(params.deliveryChargePaisa ?? 0);

  const totalPaisa =
    (params.amountPaisa ?? 0) +
    (params.taxAmountPaisa ?? 0) +
    (params.serviceChargePaisa ?? 0) +
    (params.deliveryChargePaisa ?? 0);

  const total = paisaToEsewaAmount(totalPaisa);

  // total_amount must equal the sum of its components, per the document.
  const computed = Number(amount) + Number(tax) + Number(service) + Number(delivery);
  if (Math.abs(computed - Number(total)) > 1e-9) {
    throw new EsewaError(
      `eSewa total_amount mismatch: ${amount} + ${tax} + ${service} + ${delivery} != ${total}`
    );
  }

  const transactionUuid = assertValidTransactionUuid(params.transactionUuid);

  // Must be an absolute URL, otherwise eSewa's redirect cannot reach us.
  for (const [label, url] of [
    ["success_url", params.successUrl],
    ["failure_url", params.failureUrl],
  ] as const) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new EsewaError(`eSewa ${label} must be an absolute URL, received "${url}"`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new EsewaError(`eSewa ${label} must be http(s), received "${parsed.protocol}"`);
    }
  }

  const signedValues: Record<string, string> = {
    total_amount: total,
    transaction_uuid: transactionUuid,
    product_code: config.productCode,
  };

  const signature = generateSignature(
    ESEWA_SIGNED_FIELD_NAMES,
    signedValues,
    config.secretKey
  );

  // Field order mirrors the document's example form.
  const fields: EsewaFormField[] = [
    { name: "amount", value: amount },
    { name: "tax_amount", value: tax },
    { name: "total_amount", value: total },
    { name: "transaction_uuid", value: transactionUuid },
    { name: "product_code", value: config.productCode },
    { name: "product_service_charge", value: service },
    { name: "product_delivery_charge", value: delivery },
    { name: "success_url", value: params.successUrl },
    { name: "failure_url", value: params.failureUrl },
    { name: "signed_field_names", value: ESEWA_SIGNED_FIELD_NAMES },
    { name: "signature", value: signature },
  ];

  return {
    formUrl: config.formUrl,
    fields,
    signedValues,
    signature,
    totalAmountPaisa: totalPaisa,
    transactionUuid,
    productCode: config.productCode,
  };
}

// ---------------------------------------------------------------------------
// Callback response
// ---------------------------------------------------------------------------

/** A field value preserved exactly as it appeared in the response JSON. */
export type RawField = string;

export interface EsewaCallbackResponse {
  transactionCode: string | null;
  status: string | null;
  totalAmount: number | null;
  transactionUuid: string | null;
  productCode: string | null;
  signedFieldNames: string | null;
  providedSignature: string | null;
  /** Raw, unparsed field text used for signature verification. */
  rawFields: Record<string, RawField>;
}

/**
 * Decodes the Base64 `data` parameter eSewa appends to the success URL.
 *
 * Accepts standard and URL-safe Base64, with or without padding, because the
 * value has usually passed through query-string encoding.
 */
export function decodeEsewaData(dataParam: string): string {
  const cleaned = dataParam.trim();
  if (cleaned.length === 0) {
    throw new EsewaVerificationError("eSewa response `data` parameter is empty", "EMPTY_RESPONSE");
  }

  const base64 = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  let json: string;
  try {
    json = Buffer.from(padded, "base64").toString("utf8");
  } catch {
    throw new EsewaVerificationError("eSewa response could not be Base64-decoded", "BAD_BASE64");
  }

  if (!json.trim().startsWith("{")) {
    throw new EsewaVerificationError(
      "eSewa response was not a JSON object once decoded",
      "BAD_PAYLOAD"
    );
  }
  return json;
}

/**
 * Extracts a field's RAW token text from the decoded JSON.
 *
 * This exists because of a concrete trap in eSewa's payload: it encodes
 * `total_amount` as the JSON number `1000.0` and signs the literal string
 * `"1000.0"`. A `JSON.parse` + `String()` round-trip yields `"1000"`, the
 * regenerated signature no longer matches, and every genuine payment would be
 * rejected. Reading the raw token keeps the exact signed representation.
 */
export function extractRawJsonField(json: string, field: string): string | null {
  const pattern = new RegExp(`"${escapeRegExp(field)}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|true|false|null|-?[0-9][^,}\\s]*)`);
  const match = pattern.exec(json);
  if (!match?.[1]) return null;

  const token = match[1];
  if (token.startsWith('"')) {
    try {
      return JSON.parse(token) as string;
    } catch {
      return token.slice(1, -1);
    }
  }
  return token;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parses the decoded callback body, keeping raw field text for verification. */
export function parseEsewaResponse(json: string): EsewaCallbackResponse {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new EsewaVerificationError(
      "eSewa response body was not valid JSON",
      "BAD_PAYLOAD"
    );
  }

  const rawFields: Record<string, RawField> = {};
  for (const field of [
    "transaction_code",
    "status",
    "total_amount",
    "transaction_uuid",
    "product_code",
    "signed_field_names",
    "signature",
  ]) {
    const raw = extractRawJsonField(json, field);
    if (raw !== null) rawFields[field] = raw;
  }

  const str = (v: unknown): string | null =>
    v === null || v === undefined ? null : String(v);
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    transactionCode: str(parsed.transaction_code ?? null),
    status: str(parsed.status ?? null),
    totalAmount: num(parsed.total_amount),
    transactionUuid: str(parsed.transaction_uuid ?? null),
    productCode: str(parsed.product_code ?? null),
    signedFieldNames: str(parsed.signed_field_names ?? null),
    providedSignature: str(parsed.signature ?? null),
    rawFields,
  };
}

export interface VerifiedEsewaPayment {
  response: EsewaCallbackResponse;
  status: EsewaTransactionStatus | "UNKNOWN";
  transactionCode: string | null;
  totalAmountPaisa: number;
  transactionUuid: string;
}

/**
 * Full verification of an eSewa success callback.
 *
 * Performs, in order:
 *   1. Base64 decode of the `data` parameter.
 *   2. Regeneration of the response signature from the RETURNED
 *      `signed_field_names` and the RAW field values, compared with
 *      `crypto.timingSafeEqual`.
 *   3. A match of `transaction_uuid`, `product_code` and `total_amount`
 *      against the values we originally sent.
 *
 * Any failure throws. A caller must never mark an order paid without a
 * successful return from this function.
 */
export function verifyEsewaCallback(params: {
  dataParam: string;
  expectedTransactionUuid: string;
  expectedProductCode: string;
  expectedTotalAmountPaisa: number;
  secretKey?: string;
}): VerifiedEsewaPayment {
  const config = getEsewaConfig();
  const secretKey = params.secretKey ?? config.secretKey;

  const json = decodeEsewaData(params.dataParam);
  const response = parseEsewaResponse(json);

  // --- 2. response integrity ---------------------------------------------
  const signedFieldNames = response.signedFieldNames;
  const providedSignature = response.providedSignature;

  if (!signedFieldNames) {
    throw new EsewaVerificationError(
      "eSewa response is missing signed_field_names",
      "MISSING_SIGNED_FIELD_NAMES"
    );
  }
  if (!providedSignature) {
    throw new EsewaVerificationError(
      "eSewa response is missing its signature",
      "MISSING_SIGNATURE"
    );
  }

  // Use raw token text so signed values such as "1000.0" are reproduced exactly.
  const signedValues: Record<string, string> = {};
  for (const field of signedFieldNames.split(",").map((f) => f.trim()).filter(Boolean)) {
    const raw = response.rawFields[field];
    if (raw === undefined) {
      throw new EsewaVerificationError(
        `eSewa signed_field_names references "${field}" which is absent from the response`,
        "MISSING_SIGNED_FIELD"
      );
    }
    signedValues[field] = raw;
  }

  const expectedSignature = generateSignature(signedFieldNames, signedValues, secretKey);
  if (!signaturesMatch(expectedSignature, providedSignature)) {
    throw new EsewaVerificationError(
      "eSewa response signature verification failed — payload may have been tampered with",
      "SIGNATURE_MISMATCH"
    );
  }

  // --- 3. bind the response to our order ----------------------------------
  if (!response.transactionUuid) {
    throw new EsewaVerificationError(
      "eSewa response is missing transaction_uuid",
      "MISSING_TRANSACTION_UUID"
    );
  }
  if (response.transactionUuid !== params.expectedTransactionUuid) {
    throw new EsewaVerificationError(
      `eSewa transaction_uuid mismatch: expected ${params.expectedTransactionUuid}, received ${response.transactionUuid}`,
      "TRANSACTION_UUID_MISMATCH"
    );
  }
  if (response.productCode && response.productCode !== params.expectedProductCode) {
    throw new EsewaVerificationError(
      `eSewa product_code mismatch: expected ${params.expectedProductCode}, received ${response.productCode}`,
      "PRODUCT_CODE_MISMATCH"
    );
  }
  if (response.totalAmount === null) {
    throw new EsewaVerificationError(
      "eSewa response is missing total_amount",
      "MISSING_TOTAL_AMOUNT"
    );
  }

  const receivedPaisa = Math.round(response.totalAmount * 100);
  if (receivedPaisa !== params.expectedTotalAmountPaisa) {
    throw new EsewaVerificationError(
      `eSewa total_amount mismatch: expected ${params.expectedTotalAmountPaisa} paisa, received ${receivedPaisa} paisa`,
      "TOTAL_AMOUNT_MISMATCH"
    );
  }

  const status = normaliseStatus(response.status);

  return {
    response,
    status,
    transactionCode: response.transactionCode,
    totalAmountPaisa: receivedPaisa,
    transactionUuid: response.transactionUuid,
  };
}

function normaliseStatus(status: string | null): EsewaTransactionStatus | "UNKNOWN" {
  if (!status) return "UNKNOWN";
  const upper = status.trim().toUpperCase();
  const known: readonly string[] = [
    "PENDING",
    "COMPLETE",
    "FULL_REFUND",
    "PARTIAL_REFUND",
    "AMBIGUOUS",
    "NOT_FOUND",
    "CANCELED",
  ];
  return known.includes(upper) ? (upper as EsewaTransactionStatus) : "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Transaction status API
// ---------------------------------------------------------------------------

export interface EsewaStatusResult {
  status: EsewaTransactionStatus | "UNKNOWN";
  rawStatus: string | null;
  productCode: string | null;
  transactionUuid: string | null;
  totalAmount: number | null;
  refId: string | null;
  /** True when eSewa reported the service itself as unavailable. */
  serviceUnavailable: boolean;
  errorMessage: string | null;
}

/**
 * Queries eSewa's transaction status API. Used when a payment was initiated but
 * no callback arrived, and to re-check orders left in an AMBIGUOUS state.
 *
 * The document's success/error contract is a JSON body; a non-OK HTTP status or
 * an unparseable body is reported rather than thrown, so callers can distinguish
 * "gateway says no" from "gateway unreachable".
 */
export async function checkEsewaTransactionStatus(params: {
  transactionUuid: string;
  totalAmountPaisa: number;
  productCode?: string;
  signal?: AbortSignal;
}): Promise<EsewaStatusResult> {
  const config = getEsewaConfig();
  const productCode = params.productCode ?? config.productCode;

  const url = new URL(config.statusUrl);
  url.searchParams.set("product_code", productCode);
  url.searchParams.set("transaction_uuid", params.transactionUuid);
  url.searchParams.set("total_amount", paisaToEsewaAmount(params.totalAmountPaisa));

  const empty: EsewaStatusResult = {
    status: "UNKNOWN",
    rawStatus: null,
    productCode: null,
    transactionUuid: null,
    totalAmount: null,
    refId: null,
    serviceUnavailable: false,
    errorMessage: null,
  };

  let body: string;
  let ok: boolean;
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: params.signal ?? AbortSignal.timeout(10_000),
      headers: { accept: "application/json" },
    });
    ok = res.ok;
    body = await res.text();
  } catch (err) {
    return {
      ...empty,
      errorMessage: `Could not reach eSewa status API: ${
        err instanceof Error ? err.message : "unknown error"
      }`,
    };
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = body ? (JSON.parse(body) as Record<string, unknown>) : null;
  } catch {
    data = null;
  }

  // Documented error envelope, returned with HTTP 200:
  //   { "code": 0, "error_message": "Service is currently unavailable" }
  // It has no `status` field, so it must be detected before the success parse
  // or a gateway outage is misread as "unknown transaction".
  const hasErrorEnvelope =
    data !== null &&
    typeof data.error_message === "string" &&
    typeof data.status !== "string";

  if (!ok || !data || hasErrorEnvelope) {
    return {
      ...empty,
      serviceUnavailable: hasErrorEnvelope || !ok,
      errorMessage:
        (data && typeof data.error_message === "string"
          ? data.error_message
          : null) ??
        `eSewa status API returned an unreadable response (HTTP ${ok ? "200" : "error"})`,
    };
  }

  const rawStatus = typeof data.status === "string" ? data.status : null;
  const totalAmount =
    typeof data.total_amount === "number" || typeof data.total_amount === "string"
      ? Number(data.total_amount)
      : null;

  return {
    status: normaliseStatus(rawStatus),
    rawStatus,
    productCode: typeof data.product_code === "string" ? data.product_code : null,
    transactionUuid:
      typeof data.transaction_uuid === "string" ? data.transaction_uuid : null,
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : null,
    refId: typeof data.ref_id === "string" ? data.ref_id : null,
    serviceUnavailable: false,
    errorMessage:
      typeof data.error_message === "string" ? data.error_message : null,
  };
}

// ---------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------

/**
 * Builds the absolute success/failure callback URLs from the server-configured
 * application URL. Never derived from request or client input, so an attacker
 * cannot redirect eSewa's callback to a host they control.
 */
export function buildEsewaCallbackUrls(appUrl: string, orderId: string): {
  successUrl: string;
  failureUrl: string;
} {
  const base = appUrl.replace(/\/+$/, "");
  const suffix = `?order=${encodeURIComponent(orderId)}`;
  return {
    successUrl: `${base}/payment/esewa/success${suffix}`,
    failureUrl: `${base}/payment/esewa/failure${suffix}`,
  };
}
