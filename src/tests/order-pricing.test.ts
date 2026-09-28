import { describe, expect, it } from "vitest";
import { calculateTotals } from "@/server/services/order";
import { env } from "@/lib/env";
import { toPaisa } from "@/lib/constants";
import type { CartLine } from "@/server/services/cart";

/**
 * Order total arithmetic.
 *
 * These are the numbers a customer is charged, so the unit conventions are
 * asserted explicitly: line prices, subtotal and the free-delivery threshold are
 * all in paisa, while the configured delivery charge is in rupees and must be
 * converted before being added to a paisa subtotal.
 */

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    itemId: "item-1",
    productId: "product-1",
    name: "Trail Runner",
    slug: "trail-runner",
    sku: "BKL-TR-001",
    image: null,
    size: "42",
    quantity: 1,
    // Rs. 2,000 — deliberately below FREE_DELIVERY_THRESHOLD_PAISA so the
    // delivery assertions in this file are not masked by free delivery.
    unitPrice: 200_000,
    unitMrp: 250_000,
    lineTotal: 200_000,
    availableStock: 5,
    inStock: true,
    lowStock: false,
    maxQuantity: 5,
    brandName: "Bikalpa",
    categoryName: "Sneakers",
    removed: false,
    removalReason: null,
    ...overrides,
  };
}

describe("calculateTotals", () => {
  it("sums line totals into the subtotal", () => {
    const totals = calculateTotals(
      [line(), line({ itemId: "item-2", lineTotal: 250_000, unitPrice: 250_000, unitMrp: 250_000 })],
      "Kathmandu"
    );
    expect(totals.subtotal).toBe(450_000);
  });

  it("ignores removed lines entirely", () => {
    const totals = calculateTotals(
      [line(), line({ itemId: "gone", lineTotal: 999_999, removed: true })],
      "Kathmandu"
    );
    expect(totals.subtotal).toBe(200_000);
  });

  it("reports savings as MRP minus charged price across the quantity", () => {
    const totals = calculateTotals(
      [line({ unitPrice: 150_000, unitMrp: 250_000, lineTotal: 300_000, quantity: 2 })],
      "Kathmandu"
    );
    expect(totals.savings).toBe(200_000);
    expect(totals.discount).toBe(200_000);
  });

  it("converts the rupee delivery charge into paisa", () => {
    const totals = calculateTotals([line()], "Kathmandu");
    // Rs. 80 must be 8_000 paisa, not 80 paisa.
    expect(env.DELIVERY_CHARGE_INSIDE_VALLEY_RUPEES).toBe(80);
    expect(totals.deliveryCharge).toBe(toPaisa(80));
    expect(totals.deliveryCharge).toBe(8_000);
  });

  it("charges more outside Kathmandu Valley", () => {
    const inValley = calculateTotals([line()], "Kathmandu");
    const outside = calculateTotals([line()], "Rupandehi");
    expect(outside.deliveryCharge).toBeGreaterThan(inValley.deliveryCharge);
    expect(outside.deliveryCharge).toBe(toPaisa(150));
  });

  it("treats Rupandehi districts as outside the valley", () => {
    for (const district of ["Rupandehi", "Butwal", "Bhairahawa", "Nawalparasi West"]) {
      const totals = calculateTotals([line()], district);
      expect(totals.inValley, district).toBe(false);
      expect(totals.deliveryCharge, district).toBe(toPaisa(150));
    }
  });

  it("applies free delivery at the paisa threshold", () => {
    const justUnder = calculateTotals(
      [line({ lineTotal: env.FREE_DELIVERY_THRESHOLD_PAISA - 1 })],
      "Kathmandu"
    );
    expect(justUnder.deliveryCharge).toBeGreaterThan(0);

    const atThreshold = calculateTotals(
      [line({ lineTotal: env.FREE_DELIVERY_THRESHOLD_PAISA })],
      "Kathmandu"
    );
    expect(atThreshold.deliveryCharge).toBe(0);
    expect(atThreshold.freeDeliveryApplied).toBe(true);
  });

  it("keeps the total internally consistent", () => {
    const totals = calculateTotals([line({ quantity: 3, lineTotal: 1_500_000 })], "Butwal");
    expect(totals.total).toBe(
      totals.subtotal + totals.deliveryCharge + totals.taxAmount + totals.serviceCharge
    );
  });

  it("charges nothing for an empty basket", () => {
    const totals = calculateTotals([], "Kathmandu");
    expect(totals.subtotal).toBe(0);
    expect(totals.deliveryCharge).toBe(0);
    expect(totals.total).toBe(0);
  });
});
