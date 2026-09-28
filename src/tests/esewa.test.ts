import { afterEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import {
  buildEsewaCheckout,
  buildEsewaCallbackUrls,
  buildSignatureMessage,
  checkEsewaTransactionStatus,
  decodeEsewaData,
  ESEWA_SIGNED_FIELD_NAMES,
  EsewaConfigError,
  EsewaError,
  EsewaVerificationError,
  extractRawJsonField,
  generateSignature,
  isEsewaConfigured,
  parseEsewaResponse,
  signaturesMatch,
  verifyEsewaCallback,
} from "@/lib/payments/esewa";
import { paisaToEsewaAmount, esewaAmountToPaisa } from "@/lib/constants";

/** Mirrors ESEWA_SECRET_KEY from setup.ts. */
const SECRET = "bikalpa-unit-test-secret";

function hmac(message: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(message, "utf8").digest("base64");
}

// The documented request example field set.
const REQ_MESSAGE = "total_amount=110,transaction_uuid=241028,product_code=EPAYTEST";
const REQ_SIGNATURE = "woIGGw6nzEePAZXI1W9yk+H/7HXI8OVh5qdWhqSxI/E=";

const RES_SIGNED_FIELDS =
  "transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names";
const RES_MESSAGE =
  "transaction_code=000AWEO,status=COMPLETE,total_amount=1000.0," +
  "transaction_uuid=250610-162413,product_code=EPAYTEST," +
  `signed_field_names=${RES_SIGNED_FIELDS}`;
const RES_SIGNATURE = "f02YsKzb55SaY2BvHlh48ivBv5dXZspkwE6WvrYzqhA=";

/**
 * eSewa's real payload encodes total_amount as the JSON number 1000.0. Built by
 * hand because JSON.stringify would collapse that to 1000 and the test would no
 * longer exercise the raw-token path.
 */
const CALLBACK_JSON_1000_DOT_0 = `{"transaction_code":"000AWEO","status":"COMPLETE","total_amount":1000.0,"transaction_uuid":"250610-162413","product_code":"EPAYTEST","signed_field_names":"${RES_SIGNED_FIELDS}","signature":"${RES_SIGNATURE}"}`;

function encodeData(json: string): string {
  return Buffer.from(json, "utf8").toString("base64");
}

describe("configuration", () => {
  it("reports a working test configuration", () => {
    expect(isEsewaConfigured()).toBe(true);
  });

  it("uses the documented test form endpoint", () => {
    const checkout = buildEsewaCheckout({
      amountPaisa: 10000,
      taxAmountPaisa: 1000,
      transactionUuid: "241028",
      successUrl: "http://localhost:3000/payment/esewa/success?order=abc",
      failureUrl: "http://localhost:3000/payment/esewa/failure?order=abc",
    });
    expect(checkout.formUrl).toBe("https://rc-epay.esewa.com.np/api/epay/main/v2/form");
  });

  it("derives callback URLs from the server app URL, not client input", () => {
    const urls = buildEsewaCallbackUrls("https://shop.bikalpa.com/", "clx123");
    expect(urls.successUrl).toBe(
      "https://shop.bikalpa.com/payment/esewa/success?order=clx123"
    );
    expect(urls.failureUrl).toBe(
      "https://shop.bikalpa.com/payment/esewa/failure?order=clx123"
    );
  });
});

describe("signature message construction", () => {
  it("builds the documented name=value,comma-joined message", () => {
    const message = buildSignatureMessage(ESEWA_SIGNED_FIELD_NAMES, {
      total_amount: "110",
      transaction_uuid: "241028",
      product_code: "EPAYTEST",
    });
    expect(message).toBe(REQ_MESSAGE);
  });

  it("honours the order given by signed_field_names", () => {
    const message = buildSignatureMessage("product_code,total_amount,transaction_uuid", {
      total_amount: "110",
      transaction_uuid: "241028",
      product_code: "EPAYTEST",
    });
    expect(message).toBe("product_code=EPAYTEST,total_amount=110,transaction_uuid=241028");
  });

  it("reproduces the deterministic reference signature", () => {
    expect(hmac(REQ_MESSAGE)).toBe(REQ_SIGNATURE);
    expect(
      generateSignature(ESEWA_SIGNED_FIELD_NAMES, {
        total_amount: "110",
        transaction_uuid: "241028",
        product_code: "EPAYTEST",
      }, SECRET)
    ).toBe(REQ_SIGNATURE);
  });

  it("rejects a field named in signed_field_names but absent from the values", () => {
    expect(() =>
      buildSignatureMessage("total_amount,missing_field", { total_amount: "110" })
    ).toThrow(EsewaError);
  });

  it("rejects an empty signed_field_names", () => {
    expect(() => buildSignatureMessage("   ", {})).toThrow(EsewaError);
  });
});

describe("signaturesMatch", () => {
  it("accepts identical signatures", () => {
    expect(signaturesMatch(REQ_SIGNATURE, REQ_SIGNATURE)).toBe(true);
  });

  it("rejects different signatures of equal length", () => {
    expect(signaturesMatch(REQ_SIGNATURE, RES_SIGNATURE)).toBe(false);
  });

  it("rejects signatures of differing length without throwing", () => {
    expect(signaturesMatch("abc", "abcd")).toBe(false);
  });
});

describe("checkout form", () => {
  const base = {
    transactionUuid: "BKL-20260927-120000-abc123",
    successUrl: "https://shop.bikalpa.com/payment/esewa/success?order=1",
    failureUrl: "https://shop.bikalpa.com/payment/esewa/failure?order=1",
  };

  it("emits every mandatory field exactly once", () => {
    const checkout = buildEsewaCheckout({ amountPaisa: 500000, ...base });
    const names = checkout.fields.map((f) => f.name).sort();
    expect(names).toEqual(
      [
        "amount",
        "failure_url",
        "product_code",
        "product_delivery_charge",
        "product_service_charge",
        "signature",
        "signed_field_names",
        "success_url",
        "tax_amount",
        "total_amount",
        "transaction_uuid",
      ].sort()
    );
  });

  it("never sends null or empty values", () => {
    const checkout = buildEsewaCheckout({ amountPaisa: 500000, ...base });
    for (const field of checkout.fields) {
      expect(field.value, `field ${field.name} must be non-empty`).not.toBe("");
      expect(field.value).not.toBe("null");
      expect(field.value).not.toBe("undefined");
    }
  });

  it("defaults unused tax, service and delivery charges to 0", () => {
    const checkout = buildEsewaCheckout({ amountPaisa: 500000, ...base });
    const get = (n: string) => checkout.fields.find((f) => f.name === n)?.value;
    expect(get("tax_amount")).toBe("0");
    expect(get("product_service_charge")).toBe("0");
    expect(get("product_delivery_charge")).toBe("0");
  });

  it("satisfies total = amount + tax + service + delivery", () => {
    const checkout = buildEsewaCheckout({
      ...base,
      amountPaisa: 500000,
      taxAmountPaisa: 13000,
      serviceChargePaisa: 2500,
      deliveryChargePaisa: 8000,
    });
    const get = (n: string) => Number(checkout.fields.find((f) => f.name === n)?.value);
    expect(get("total_amount")).toBe(
      get("amount") + get("tax_amount") + get("product_service_charge") + get("product_delivery_charge")
    );
    expect(get("amount")).toBe(5000);
    expect(get("tax_amount")).toBe(130);
    expect(get("product_service_charge")).toBe(25);
    expect(get("product_delivery_charge")).toBe(80);
    expect(get("total_amount")).toBe(5235);
  });

  it("signs the documented signed_field_names value", () => {
    const checkout = buildEsewaCheckout({ amountPaisa: 500000, ...base });
    const signedNames = checkout.fields.find((f) => f.name === "signed_field_names")?.value;
    expect(signedNames).toBe("total_amount,transaction_uuid,product_code");
  });

  it("produces a signature matching its own declared fields", () => {
    const checkout = buildEsewaCheckout({ amountPaisa: 500000, ...base });
    const get = (n: string) => checkout.fields.find((f) => f.name === n)?.value ?? "";
    const expected = hmac(
      `total_amount=${get("total_amount")},transaction_uuid=${get("transaction_uuid")},product_code=${get("product_code")}`
    );
    expect(get("signature")).toBe(expected);
  });

  it("rejects a transaction_uuid with disallowed characters", () => {
    expect(() =>
      buildEsewaCheckout({ ...base, amountPaisa: 100, transactionUuid: "BKL_2026/x" })
    ).toThrow(/alphanumeric/);
  });

  it("rejects a relative success_url", () => {
    expect(() =>
      buildEsewaCheckout({
        amountPaisa: 100,
        successUrl: "/payment/esewa/success",
        failureUrl: base.failureUrl,
        transactionUuid: base.transactionUuid,
      })
    ).toThrow(/absolute URL/);
  });

  it("rejects a non-http callback scheme", () => {
    expect(() =>
      buildEsewaCheckout({
        amountPaisa: 100,
        successUrl: "javascript:alert(1)",
        failureUrl: base.failureUrl,
        transactionUuid: base.transactionUuid,
      })
    ).toThrow(/must be http/);
  });
});

describe("response decoding", () => {
  it("decodes standard base64", () => {
    const json = decodeEsewaData(encodeData('{"status":"COMPLETE"}'));
    expect(JSON.parse(json)).toEqual({ status: "COMPLETE" });
  });

  it("decodes url-safe base64 and restores padding", () => {
    const original = '{"status":"COMPLETE","ref":"a+b/c="}';
    const urlsafe = Buffer.from(original, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(JSON.parse(decodeEsewaData(urlsafe))).toEqual({
      status: "COMPLETE",
      ref: "a+b/c=",
    });
  });

  it("rejects an empty data parameter", () => {
    expect(() => decodeEsewaData("   ")).toThrow(EsewaVerificationError);
  });

  it("rejects a payload that is not a JSON object", () => {
    expect(() => decodeEsewaData(encodeData("<xml>not json</xml>"))).toThrow(
      EsewaVerificationError
    );
  });
});

describe("raw JSON field extraction", () => {
  it("preserves the trailing zero of 1000.0 that JSON.parse would destroy", () => {
    const raw = extractRawJsonField(CALLBACK_JSON_1000_DOT_0, "total_amount");
    expect(raw).toBe("1000.0");
    // Demonstrate the bug this guards against.
    expect(String(JSON.parse(CALLBACK_JSON_1000_DOT_0).total_amount)).toBe("1000");
  });

  it("extracts plain string values", () => {
    expect(extractRawJsonField(CALLBACK_JSON_1000_DOT_0, "status")).toBe("COMPLETE");
    expect(extractRawJsonField(CALLBACK_JSON_1000_DOT_0, "transaction_code")).toBe("000AWEO");
  });

  it("returns null for absent fields", () => {
    expect(extractRawJsonField('{"a":"b"}', "total_amount")).toBeNull();
  });

  it("is not fooled by a field name appearing inside a string value", () => {
    const json = '{"note":"status COMPLETE here","status":"PENDING"}';
    expect(extractRawJsonField(json, "status")).toBe("PENDING");
  });
});

describe("parseEsewaResponse", () => {
  it("maps every documented field", () => {
    const parsed = parseEsewaResponse(CALLBACK_JSON_1000_DOT_0);
    expect(parsed.transactionCode).toBe("000AWEO");
    expect(parsed.status).toBe("COMPLETE");
    expect(parsed.totalAmount).toBe(1000);
    expect(parsed.transactionUuid).toBe("250610-162413");
    expect(parsed.productCode).toBe("EPAYTEST");
    expect(parsed.signedFieldNames).toBe(RES_SIGNED_FIELDS);
    expect(parsed.providedSignature).toBe(RES_SIGNATURE);
    // raw token retains 1000.0 even though totalAmount parsed to 1000
    expect(parsed.rawFields.total_amount).toBe("1000.0");
  });

  it("tolerates a null ref_id style field", () => {
    const parsed = parseEsewaResponse('{"status":"PENDING","ref_id":null}');
    expect(parsed.status).toBe("PENDING");
  });
});

describe("verifyEsewaCallback", () => {
  const expected = {
    expectedTransactionUuid: "250610-162413",
    expectedProductCode: "EPAYTEST",
    expectedTotalAmountPaisa: 100000,
  };

  it("accepts a genuine COMPLETE response signed over the literal 1000.0", () => {
    const result = verifyEsewaCallback({
      dataParam: encodeData(CALLBACK_JSON_1000_DOT_0),
      ...expected,
    });
    expect(result.status).toBe("COMPLETE");
    expect(result.transactionCode).toBe("000AWEO");
    expect(result.totalAmountPaisa).toBe(100000);
  });

  it("rejects a response whose signature was computed over the normalised 1000", () => {
    // Proves verification uses the raw token and is not accidentally lenient.
    const naive = hmac(RES_MESSAGE.replace("total_amount=1000.0", "total_amount=1000"));
    const json = CALLBACK_JSON_1000_DOT_0.replace(RES_SIGNATURE, naive);
    expect(() =>
      verifyEsewaCallback({ dataParam: encodeData(json), ...expected })
    ).toThrow(/signature verification failed/);
  });

  it("rejects a tampered status", () => {
    const json = CALLBACK_JSON_1000_DOT_0.replace('"COMPLETE"', '"FAILED"');
    expect(() =>
      verifyEsewaCallback({ dataParam: encodeData(json), ...expected })
    ).toThrow(EsewaVerificationError);
  });

  it("rejects a tampered amount", () => {
    const json = CALLBACK_JSON_1000_DOT_0.replace("1000.0", "1.0");
    expect(() =>
      verifyEsewaCallback({ dataParam: encodeData(json), ...expected })
    ).toThrow(EsewaVerificationError);
  });

  it("rejects a response signed with the wrong key", () => {
    const forged = hmac(RES_MESSAGE, "attacker-secret");
    const json = CALLBACK_JSON_1000_DOT_0.replace(RES_SIGNATURE, forged);
    expect(() =>
      verifyEsewaCallback({ dataParam: encodeData(json), ...expected })
    ).toThrow(/signature verification failed/);
  });

  it("rejects a mismatched transaction_uuid", () => {
    expect(() =>
      verifyEsewaCallback({
        dataParam: encodeData(CALLBACK_JSON_1000_DOT_0),
        ...expected,
        expectedTransactionUuid: "some-other-order",
      })
    ).toThrow(/transaction_uuid mismatch/);
  });

  it("rejects a mismatched product_code", () => {
    expect(() =>
      verifyEsewaCallback({
        dataParam: encodeData(CALLBACK_JSON_1000_DOT_0),
        ...expected,
        expectedProductCode: "OTHERMERCHANT",
      })
    ).toThrow(/product_code mismatch/);
  });

  it("rejects a mismatched total_amount", () => {
    expect(() =>
      verifyEsewaCallback({
        dataParam: encodeData(CALLBACK_JSON_1000_DOT_0),
        ...expected,
        expectedTotalAmountPaisa: 1,
      })
    ).toThrow(/total_amount mismatch/);
  });

  it("rejects a response with no signature", () => {
    const json = CALLBACK_JSON_1000_DOT_0.replace(`,"signature":"${RES_SIGNATURE}"`, "");
    expect(() =>
      verifyEsewaCallback({ dataParam: encodeData(json), ...expected })
    ).toThrow(/missing its signature/);
  });

  it("rejects a response with no signed_field_names", () => {
    const json = CALLBACK_JSON_1000_DOT_0.replace(
      `"signed_field_names":"${RES_SIGNED_FIELDS}"`,
      '"signed_field_names":null'
    );
    expect(() =>
      verifyEsewaCallback({ dataParam: encodeData(json), ...expected })
    ).toThrow(/signed_field_names/);
  });

  it("classifies every documented transaction status", () => {
    for (const [raw, expectedStatus] of [
      ["PENDING", "PENDING"],
      ["COMPLETE", "COMPLETE"],
      ["FULL_REFUND", "FULL_REFUND"],
      ["PARTIAL_REFUND", "PARTIAL_REFUND"],
      ["AMBIGUOUS", "AMBIGUOUS"],
      ["NOT_FOUND", "NOT_FOUND"],
      ["CANCELED", "CANCELED"],
    ] as const) {
      const message = [
        `transaction_code=000AWEO`,
        `status=${raw}`,
        `total_amount=1000.0`,
        `transaction_uuid=250610-162413`,
        `product_code=EPAYTEST`,
        `signed_field_names=${RES_SIGNED_FIELDS}`,
      ].join(",");
      const sig = hmac(message);
      const json = `{"transaction_code":"000AWEO","status":"${raw}","total_amount":1000.0,"transaction_uuid":"250610-162413","product_code":"EPAYTEST","signed_field_names":"${RES_SIGNED_FIELDS}","signature":"${sig}"}`;
      const result = verifyEsewaCallback({
        dataParam: encodeData(json),
        ...expected,
      });
      expect(result.status, `status ${raw}`).toBe(expectedStatus);
    }
  });
});

describe("checkEsewaTransactionStatus", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("queries the documented parameters and parses a COMPLETE response", async () => {
    let requested = "";
    globalThis.fetch = (async (url: string | URL) => {
      requested = String(url);
      return new Response(
        JSON.stringify({
          product_code: "EPAYTEST",
          transaction_uuid: "240508-10108",
          total_amount: 100.0,
          status: "COMPLETE",
          ref_id: "0007G36",
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const result = await checkEsewaTransactionStatus({
      transactionUuid: "240508-10108",
      totalAmountPaisa: 10000,
    });

    expect(requested).toContain("https://rc.esewa.com.np/api/epay/transaction/status/");
    expect(requested).toContain("product_code=EPAYTEST");
    expect(requested).toContain("transaction_uuid=240508-10108");
    expect(requested).toContain("total_amount=100");
    expect(result.status).toBe("COMPLETE");
    expect(result.refId).toBe("0007G36");
  });

  it("reports the documented service-unavailable envelope", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ code: 0, error_message: "Service is currently unavailable" }),
        { status: 200 }
      )) as typeof fetch;

    const result = await checkEsewaTransactionStatus({
      transactionUuid: "x-1",
      totalAmountPaisa: 100,
    });
    expect(result.serviceUnavailable).toBe(true);
    expect(result.errorMessage).toBe("Service is currently unavailable");
  });

  it("does not throw when the gateway is unreachable", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;

    const result = await checkEsewaTransactionStatus({
      transactionUuid: "x-2",
      totalAmountPaisa: 100,
    });
    expect(result.status).toBe("UNKNOWN");
    expect(result.errorMessage).toContain("Could not reach eSewa");
  });
});

describe("amount conversion", () => {
  it("formats whole rupees without a decimal point", () => {
    expect(paisaToEsewaAmount(10000)).toBe("100");
    expect(paisaToEsewaAmount(0)).toBe("0");
  });

  it("formats fractional rupees to two places", () => {
    expect(paisaToEsewaAmount(12345)).toBe("123.45");
    expect(paisaToEsewaAmount(5)).toBe("0.05");
  });

  it("rejects non-integer or negative paisa", () => {
    expect(() => paisaToEsewaAmount(-1)).toThrow(RangeError);
    expect(() => paisaToEsewaAmount(1.5)).toThrow(RangeError);
  });

  it("round-trips through esewaAmountToPaisa", () => {
    expect(esewaAmountToPaisa("1000.0")).toBe(100000);
    expect(esewaAmountToPaisa(1000)).toBe(100000);
    expect(esewaAmountToPaisa("5230")).toBe(523000);
  });
});

describe("production safety", () => {
  it("exposes a config error type for unconfigured deployments", () => {
    expect(EsewaConfigError.prototype).toBeInstanceOf(Error);
  });
});
