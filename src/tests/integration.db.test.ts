import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  listProducts,
  getProductBySlug,
  getFeaturedProducts,
  getActiveCategories,
  getActiveBrands,
  getAvailableSizes,
} from "@/server/services/products";
import { getCartView, addToCart, clearCart, CartError } from "@/server/services/cart";
import { calculateTotals, releaseOrderStock } from "@/server/services/order";
import { buildEsewaCheckout } from "@/lib/payments/esewa";
import { productQuerySchema } from "@/lib/schemas";
import { formatNPR, toPaisa, esewaAmountToPaisa } from "@/lib/constants";
import { REQUIRE_DB } from "./setup";

/**
 * Integration tests against a real MongoDB.
 *
 * These exercise the query layer the unit tests cannot: Prisma's generated
 * filters, the actual seed data, and money recomputed from stored rows.
 *
 * These tests do NOT self-skip. If MongoDB is unreachable they fail, because a
 * suite that quietly returns early reports green while asserting nothing — a
 * bug that already hid a bad sort key and a wrong test database in this file.
 * Every assertion below is load-bearing.
 *
 * Requires: `npm run db:push && npm run seed`
 */

const SEEDED_TOTAL = 6;
const ADMIN_EMAIL = "admin@bikalpa.com";

let adminId: string;

async function probe(): Promise<void> {
  await prisma.$connect();
  await prisma.$runCommandRaw({ ping: 1 });

  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    throw new Error(
      `[integration] Seed data missing: no user "${ADMIN_EMAIL}". ` +
        `Run \`npm run db:push && npm run seed\` before the integration tests.`
    );
  }
  adminId = admin.id;
}

beforeAll(async () => {
  try {
    await probe();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (REQUIRE_DB) throw err;
    // Skipping loudly rather than silently: the suite is opt-in, but a skip is
    // impossible to mistake for a pass.
    throw new Error(
      `Integration tests could not reach the seeded database at ` +
        `${process.env.DATABASE_URL}\n${message}\n` +
        `Run \`npm run db:push && npm run seed\`, or set BILKALPA_REQUIRE_DB=1 to make this fatal in CI.`
    );
  }
});

afterAll(async () => {
  await clearCart(adminId).catch(() => undefined);
  await prisma.$disconnect();
});

describe("catalogue", () => {
  it("lists the seeded catalogue", async () => {
    const all = await listProducts(productQuerySchema.parse({ perPage: 60 }));
    expect(all.total).toBe(SEEDED_TOTAL);
    expect(all.products.length).toBe(SEEDED_TOTAL);
  });

  it("computes a price range and facets", async () => {
    const all = await listProducts(productQuerySchema.parse({ perPage: 60 }));
    expect(all.facets.priceRange?.min).toBeGreaterThan(0);
    expect(all.facets.priceRange?.max).toBeGreaterThan(all.facets.priceRange?.min ?? 0);
    expect(all.facets.brands).toHaveLength(6);
    expect(all.facets.sizes.length).toBeGreaterThan(0);
    expect(all.facets.categories.length).toBe(1);
  });

  it("loads featured products, categories, brands and sizes", async () => {
    expect((await getFeaturedProducts(8)).length).toBeGreaterThan(0);
    expect((await getActiveCategories()).length).toBe(1);
    expect((await getActiveBrands()).length).toBe(6);
    expect((await getAvailableSizes()).length).toBeGreaterThan(0);
  });
});

describe("filters", () => {
  it("filters by category", async () => {
    const r = await listProducts(productQuerySchema.parse({ category: "sneakers" }));
    expect(r.total).toBe(SEEDED_TOTAL);
    expect(r.products.every((p) => p.category.slug === "sneakers")).toBe(true);
  });

  it("filters on-sale and in-stock", async () => {
    const sale = await listProducts(productQuerySchema.parse({ onSale: true }));
    expect(sale.total).toBeGreaterThan(0);
    expect(sale.total).toBeLessThan(SEEDED_TOTAL);
    expect(sale.products.every((p) => p.discountPrice !== null)).toBe(true);

    const inStock = await listProducts(productQuerySchema.parse({ inStock: true }));
    expect(inStock.total).toBe(SEEDED_TOTAL);
  });

  it("filters by a price ceiling", async () => {
    const cheap = await listProducts(productQuerySchema.parse({ maxPrice: toPaisa(10000) }));
    expect(cheap.total).toBeGreaterThan(0);
    expect(cheap.total).toBeLessThan(SEEDED_TOTAL);
    for (const p of cheap.products) {
      expect(p.discountPrice ?? p.price).toBeLessThanOrEqual(toPaisa(10000));
    }
  });

  it("searches text and treats metacharacters literally", async () => {
    const hit = await listProducts(productQuerySchema.parse({ q: "samba" }));
    expect(hit.total).toBeGreaterThanOrEqual(1);

    const byBrand = await listProducts(productQuerySchema.parse({ q: "converse" }));
    expect(byBrand.total).toBeGreaterThanOrEqual(1);

    // A regex pattern would match everything; it must match nothing.
    const literal = await listProducts(productQuerySchema.parse({ q: ".*" }));
    expect(literal.total).toBe(0);
  });

  it("paginates", async () => {
    const page2 = await listProducts(productQuerySchema.parse({ perPage: 4, page: 2 }));
    expect(page2.page).toBe(2);
    expect(page2.products).toHaveLength(2);
    expect(page2.totalPages).toBe(2);

    const page1 = await listProducts(productQuerySchema.parse({ perPage: 4, page: 1 }));
    expect(page1.products).toHaveLength(4);
    const overlap = page1.products.filter((p) => page2.products.some((q) => q.id === p.id));
    expect(overlap).toHaveLength(0);
  });

  it("orders by ascending price", async () => {
    const r = await listProducts(productQuerySchema.parse({ sort: "price_asc", perPage: 60 }));
    const prices = r.products.map((p) => p.discountPrice ?? p.price);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it("rejects an unknown sort key instead of silently defaulting", () => {
    // A typo in a UI constant must surface as a failure, not a silent fallback.
    expect(() => productQuerySchema.parse({ sort: "price-asc" })).toThrow();
  });
});

describe("product detail", () => {
  it("loads a product with consistent stock", async () => {
    const p = await getProductBySlug("adidas-samba-og");
    expect(p).not.toBeNull();
    expect(p!.sizes).toHaveLength(7);
    expect(p!.totalStock).toBe(p!.sizes.reduce((s, x) => s + x.stock, 0));
    expect(p!.discountPrice).toBe(toPaisa(9500));
    expect(p!.discountPrice!).toBeLessThan(p!.price);
  });

  it("returns null for an unknown slug", async () => {
    expect(await getProductBySlug("does-not-exist-at-all")).toBeNull();
  });
});

describe("cart", () => {
  beforeAll(async () => {
    await clearCart(adminId);
  });

  it("adds an item and recomputes money from the database", async () => {
    const product = (await getProductBySlug("adidas-samba-og"))!;
    const size = product.sizes.find((s) => s.stock > 0)!.size;

    const view = await addToCart(adminId, { productId: product.id, size, quantity: 2 });
    expect(view.lines).toHaveLength(1);

    const line = view.lines[0]!;
    expect(line.unitPrice).toBe(toPaisa(9500));
    expect(line.lineTotal).toBe(line.unitPrice * 2);
    expect(view.subtotal).toBe(line.lineTotal);
    expect(view.savings).toBe((line.unitMrp - line.unitPrice) * 2);
    expect(view.itemCount).toBe(2);
    expect(formatNPR(view.subtotal)).toBe("Rs. 19,000");
  });

  it("persists across reads", async () => {
    const view = await getCartView(adminId);
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]!.quantity).toBe(2);
  });

  it("refuses to exceed real stock", async () => {
    const product = (await getProductBySlug("adidas-samba-og"))!;
    const size = product.sizes.find((s) => s.stock > 0)!.size;
    await expect(
      addToCart(adminId, { productId: product.id, size, quantity: 100_000 })
    ).rejects.toBeInstanceOf(CartError);
  });

  it("refuses a size that does not exist", async () => {
    const product = (await getProductBySlug("adidas-samba-og"))!;
    await expect(
      addToCart(adminId, { productId: product.id, size: "5", quantity: 1 })
    ).rejects.toBeInstanceOf(CartError);
  });
});

describe("order pricing from a live cart", () => {
  /**
   * A single hand-built line under the free-delivery threshold, so delivery
   * charges are actually exercised. The seeded cart is deliberately above the
   * threshold, which would mask them.
   */
  async function smallLine() {
    const product = (await getProductBySlug("vans-old-skool"))!;
    const unit = product.discountPrice ?? product.price;
    expect(unit).toBeLessThan(500_000); // under the Rs. 5,000 free-delivery threshold

    return {
      itemId: "test-line",
      productId: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      image: null,
      size: product.sizes[0]!.size,
      quantity: 1,
      unitPrice: unit,
      unitMrp: product.price,
      lineTotal: unit,
      availableStock: 1,
      inStock: true,
      lowStock: false,
      maxQuantity: 5,
      brandName: product.brand.name,
      categoryName: product.category.name,
      removed: false,
      removalReason: null,
    };
  }

  it("charges the Valley rate inside the Valley", async () => {
    const valley = calculateTotals([await smallLine()], "Kathmandu");
    expect(valley.inValley).toBe(true);
    expect(valley.deliveryCharge).toBe(toPaisa(80));
    expect(formatNPR(valley.deliveryCharge)).toBe("Rs. 80");
    expect(valley.total).toBe(valley.subtotal + toPaisa(80));
  });

  it("charges the outside-valley rate to a district outside the Valley", async () => {
    const outside = calculateTotals([await smallLine()], "Rupandehi");
    expect(outside.inValley).toBe(false);
    expect(
      outside.total - outside.subtotal - (outside.taxAmount + outside.serviceCharge)
    ).toBe(toPaisa(150));
  });

  it("waives delivery above the free-delivery threshold", async () => {
    // The seeded cart holds Rs. 10,400 of goods, which is over the threshold.
    const { lines, subtotal } = await getCartView(adminId);
    expect(subtotal).toBeGreaterThanOrEqual(500_000);

    const totals = calculateTotals(lines, "Kathmandu");
    expect(totals.deliveryCharge).toBe(0);
    expect(totals.total).toBe(totals.subtotal);
  });

  it("treats Lalitpur and Bhaktapur as inside the Valley but Butwal as outside", async () => {
    const line = await smallLine();
    for (const district of ["Kathmandu", "Lalitpur", "Bhaktapur"]) {
      expect(calculateTotals([line], district).inValley, district).toBe(true);
    }
    for (const district of ["Butwal", "Bhairahawa", "Rupandehi", "Pokhara"]) {
      expect(calculateTotals([line], district).inValley, district).toBe(false);
    }
  });
});

describe("stock release is idempotent", () => {
  /**
   * A replayed eSewa failure callback (or a cancel after a release) must not put
   * the same units back on the shelf twice. `releaseOrderStock` claims the work
   * with an atomic `stockReleasedAt: null` update; this asserts the claim holds.
   */
  it("returns stock to the shelf exactly once, however often it is called", async () => {
    const product = (await getProductBySlug("adidas-samba-og"))!;
    const size = product.sizes.find((s) => s.stock > 0)!;
    const before = await prisma.productSize.findFirstOrThrow({
      where: { productId: product.id, size: size.size },
    });
    const productBefore = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });

    // Reserve one unit the way checkout does, then build an order around it.
    await prisma.productSize.update({
      where: { id: before.id },
      data: { stock: { decrement: 1 } },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { totalStock: { decrement: 1 } },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `BKL-TEST-RELEASE-${Date.now()}`,
        status: "PAYMENT_FAILED",
        paymentStatus: "FAILED",
        subtotal: product.discountPrice ?? product.price,
        total: product.discountPrice ?? product.price,
        customerName: "Test Customer",
        email: "release-test@bikalpa.test",
        phone: "9800000000",
        province: "Bagmati",
        district: "Kathmandu",
        municipality: "Kathmandu Metropolitan City",
        addressLine: "Test address, ward 1",
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            productSku: product.sku,
            size: size.size,
            quantity: 1,
            unitPrice: product.discountPrice ?? product.price,
            unitMrp: product.price,
            lineTotal: product.discountPrice ?? product.price,
          },
        },
      },
    });

    try {
      await releaseOrderStock(order.id);
      await releaseOrderStock(order.id);
      await releaseOrderStock(order.id);

      const after = await prisma.productSize.findFirstOrThrow({
        where: { id: before.id },
      });
      const productAfter = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });

      expect(after.stock).toBe(before.stock);
      expect(productAfter.totalStock).toBe(productBefore.totalStock);

      const claimed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(claimed.stockReleased).toBe(true);
      expect(claimed.stockReleasedAt).not.toBeNull();
    } finally {
      // Leave the catalogue exactly as we found it.
      await prisma.order.delete({ where: { id: order.id } });
      const restored = await prisma.productSize.findFirstOrThrow({ where: { id: before.id } });
      await prisma.productSize.update({
        where: { id: restored.id },
        data: { stock: before.stock },
      });
      await prisma.product.update({
        where: { id: product.id },
        data: { totalStock: productBefore.totalStock },
      });
    }
  });

  it("leaves a paid order's stock alone", async () => {
    const product = (await getProductBySlug("adidas-samba-og"))!;
    const size = product.sizes.find((s) => s.stock > 0)!;
    const before = await prisma.productSize.findFirstOrThrow({
      where: { productId: product.id, size: size.size },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `BKL-TEST-PAID-${Date.now()}`,
        status: "PAID",
        paymentStatus: "PAID",
        subtotal: product.discountPrice ?? product.price,
        total: product.discountPrice ?? product.price,
        customerName: "Test Customer",
        email: "paid-test@bikalpa.test",
        phone: "9800000000",
        province: "Bagmati",
        district: "Kathmandu",
        municipality: "Kathmandu Metropolitan City",
        addressLine: "Test address, ward 1",
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            productSku: product.sku,
            size: size.size,
            quantity: 1,
            unitPrice: product.discountPrice ?? product.price,
            unitMrp: product.price,
            lineTotal: product.discountPrice ?? product.price,
          },
        },
      },
    });

    try {
      await releaseOrderStock(order.id);
      const after = await prisma.productSize.findFirstOrThrow({ where: { id: before.id } });
      expect(after.stock).toBe(before.stock);
    } finally {
      await prisma.order.delete({ where: { id: order.id } });
    }
  });
});

describe("eSewa request construction", () => {
  // Rs. 104.00 of goods + Rs. 0.80 delivery = Rs. 104.80.
  const params = {
    amountPaisa: toPaisa(104),
    deliveryChargePaisa: 80,
    taxAmountPaisa: 0,
    serviceChargePaisa: 0,
    transactionUuid: "BKL-TEST-0001-A1B2C3D4",
    successUrl: "http://localhost:3000/payment/esewa/success?order=65f0000000000000000000a1",
    failureUrl: "http://localhost:3000/payment/esewa/failure?order=65f0000000000000000000a1",
  };

  const fieldOf = (fields: { name: string; value: string }[], name: string) =>
    fields.find((f) => f.name === name)?.value;

  it("targets the test gateway in test mode", () => {
    const c = buildEsewaCheckout(params);
    expect(c.formUrl).toContain("rc-epay.esewa.com.np");
    expect(c.productCode).toBe("EPAYTEST");
    expect(fieldOf(c.fields, "product_code")).toBe("EPAYTEST");
  });

  it("sends components that sum to total_amount", () => {
    const c = buildEsewaCheckout(params);
    const amount = Number(fieldOf(c.fields, "amount"));
    const tax = Number(fieldOf(c.fields, "tax_amount"));
    const service = Number(fieldOf(c.fields, "product_service_charge"));
    const delivery = Number(fieldOf(c.fields, "product_delivery_charge"));
    const total = Number(fieldOf(c.fields, "total_amount"));

    expect(total).toBeCloseTo(amount + tax + service + delivery, 9);
    expect(total).toBe(104.8);
    expect(c.totalAmountPaisa).toBe(toPaisa(104.8));

    // The signed total must be the same integer paisa the order stored, since
    // the callback is verified against `totalAmountPaisa` numerically.
    expect(esewaAmountToPaisa(fieldOf(c.fields, "total_amount")!)).toBe(c.totalAmountPaisa);
  });

  it("emits a plain numeric string with no grouping or currency noise", () => {
    const c = buildEsewaCheckout(params);
    for (const name of [
      "amount",
      "tax_amount",
      "total_amount",
      "product_service_charge",
      "product_delivery_charge",
    ]) {
      expect(fieldOf(c.fields, name), name).toMatch(/^\d+(\.\d{1,2})?$/);
    }
    // 1,048,000 paisa must never appear as "1048000" rupees or "1,048.00".
    expect(fieldOf(c.fields, "total_amount")).not.toContain(",");
  });

  it("requires absolute callback URLs", () => {
    expect(() => buildEsewaCheckout({ ...params, successUrl: "/relative/path" })).toThrow();
    expect(() => buildEsewaCheckout({ ...params, failureUrl: "javascript:alert(1)" })).toThrow();
  });

  it("rejects a transaction uuid eSewa would refuse", () => {
    expect(() => buildEsewaCheckout({ ...params, transactionUuid: "has spaces" })).toThrow();
    expect(() => buildEsewaCheckout({ ...params, transactionUuid: "x".repeat(65) })).toThrow();
  });

  it("binds the callbacks to the order id", () => {
    const c = buildEsewaCheckout(params);
    expect(fieldOf(c.fields, "success_url")).toContain("order=");
    expect(fieldOf(c.fields, "failure_url")).toContain("order=");
  });

  it("signs the documented field list", () => {
    const c = buildEsewaCheckout(params);
    expect(fieldOf(c.fields, "signed_field_names")).toBe(
      "total_amount,transaction_uuid,product_code"
    );
    expect(c.signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("is deterministic for identical input", () => {
    const a = buildEsewaCheckout(params);
    const b = buildEsewaCheckout(params);
    expect(a.signature).toBe(b.signature);
    expect(a.transactionUuid).toBe(b.transactionUuid);
  });

  it("changes the signature when the amount changes", () => {
    const a = buildEsewaCheckout(params);
    const b = buildEsewaCheckout({ ...params, amountPaisa: toPaisa(105) });
    expect(a.signature).not.toBe(b.signature);
  });
});
