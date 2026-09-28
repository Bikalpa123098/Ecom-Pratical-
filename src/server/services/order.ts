import "server-only";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  buildOrderNumber,
  effectivePrice,
  toPaisa,
  PAISA,
  type OrderStatus,
} from "@/lib/constants";
import { isInsideKathmanduValley } from "@/lib/geo";
import type { CartLine } from "@/server/services/cart";
import { OutOfStockError } from "@/server/validation";

/**
 * Order creation and lifecycle.
 *
 * Money is computed here and only here, from database prices. The client sends
 * contact and delivery details plus a list of product/size/quantity choices;
 * every rupee figure in the resulting order originates from the Product table.
 *
 * Stock is decremented with a conditional atomic update
 * (`stock: { gte: qty }`). If two shoppers race for the last pair, exactly one
 * update matches and the other is rolled back, so a pair cannot be oversold.
 */

export interface OrderTotals {
  subtotal: number;
  savings: number;
  discount: number;
  deliveryCharge: number;
  taxAmount: number;
  serviceCharge: number;
  total: number;
  freeDeliveryApplied: boolean;
  inValley: boolean;
}

export interface CheckoutDetails {
  fullName: string;
  email: string;
  phone: string;
  province: string;
  district: string;
  municipality: string;
  wardNumber: string;
  tole: string;
  addressLine: string;
  postalCode: string;
  deliveryNotes: string;
}

export class OrderError extends Error {
  override name = "OrderError";
}

/**
 * Delivery pricing. Inside the Kathmandu Valley is cheaper; orders above the
 * free-delivery threshold ship free. Both thresholds are in paisa and come
 * from environment configuration.
 */
export function calculateTotals(
  lines: CartLine[],
  district: string
): OrderTotals {
  const active = lines.filter((l) => !l.removed);

  const subtotal = active.reduce((sum, l) => sum + l.lineTotal, 0);
  const savings = active.reduce(
    (sum, l) => sum + Math.max(0, l.unitMrp - l.unitPrice) * l.quantity,
    0
  );

  const inValley = isInsideKathmanduValley(district);
  // Configured in rupees, applied in paisa.
  const baseDeliveryPaisa = toPaisa(
    inValley
      ? env.DELIVERY_CHARGE_INSIDE_VALLEY_RUPEES
      : env.DELIVERY_CHARGE_OUTSIDE_VALLEY_RUPEES
  );

  const qualifiesFree =
    env.FREE_DELIVERY_THRESHOLD_PAISA > 0 &&
    subtotal >= env.FREE_DELIVERY_THRESHOLD_PAISA;

  const deliveryCharge =
    subtotal === 0 ? 0 : qualifiesFree ? 0 : baseDeliveryPaisa;

  // Discount is already reflected in each line's unit price, so it is reported
  // for display and reconciliation rather than subtracted a second time.
  const discount = savings;
  const taxAmount = Math.round((subtotal * env.TAX_RATE_BPS) / 10_000);
  const serviceCharge = 0;
  const total = subtotal + deliveryCharge + taxAmount + serviceCharge;

  return {
    subtotal,
    savings,
    discount,
    deliveryCharge,
    taxAmount,
    serviceCharge,
    total,
    freeDeliveryApplied: qualifiesFree,
    inValley,
  };
}

function nonce(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("")
    .slice(0, 12)
    .toUpperCase();
}

/**
 * Creates a PENDING_PAYMENT order and reserves stock.
 *
 * Idempotent on `idempotencyKey`: a double-submitted checkout returns the
 * original order instead of creating a second one or reserving stock twice.
 */
export async function createPendingOrder(params: {
  userId: string | null;
  lines: CartLine[];
  details: CheckoutDetails;
  idempotencyKey: string;
}): Promise<{ orderId: string; orderNumber: string; totals: OrderTotals; guestAccessToken: string | null }> {
  const { userId, lines, details, idempotencyKey } = params;

  const existing = await prisma.order.findUnique({
    where: { idempotencyKey },
    select: {
      id: true,
      orderNumber: true,
      subtotal: true,
      discount: true,
      deliveryCharge: true,
      taxAmount: true,
      serviceCharge: true,
      total: true,
      guestAccessToken: true,
    },
  });
  if (existing) {
    return {
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      guestAccessToken: existing.guestAccessToken,
      totals: {
        subtotal: existing.subtotal,
        savings: existing.discount,
        discount: existing.discount,
        deliveryCharge: existing.deliveryCharge,
        taxAmount: existing.taxAmount,
        serviceCharge: existing.serviceCharge,
        total: existing.total,
        freeDeliveryApplied: existing.deliveryCharge === 0,
        inValley: isInsideKathmanduValley(details.district),
      },
    };
  }

  const active = lines.filter((l) => !l.removed);
  if (active.length === 0) {
    throw new OrderError("Your bag is empty.");
  }

  // Re-read products from the database; never trust the cart view's prices.
  const productIds = [...new Set(active.map((l) => l.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, status: "ACTIVE" },
    include: { sizes: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  for (const line of active) {
    const product = productById.get(line.productId);
    if (!product) {
      throw new OutOfStockError(`"${line.name}" is no longer available.`);
    }
    const sizeRow = product.sizes.find((s) => s.size === line.size);
    if (!sizeRow || !sizeRow.isActive) {
      throw new OutOfStockError(
        `Size ${line.size} of "${product.name}" is no longer offered.`
      );
    }
    if (sizeRow.stock < line.quantity) {
      throw new OutOfStockError(
        `Only ${sizeRow.stock} left of "${product.name}" in size ${line.size}.`
      );
    }
  }

  const totals = calculateTotals(
    active.map((l) => {
      const product = productById.get(l.productId)!;
      const unitPrice = effectivePrice(product.price, product.discountPrice);
      return { ...l, unitPrice, unitMrp: product.price, lineTotal: unitPrice * l.quantity };
    }),
    details.district
  );

  const orderNumber = buildOrderNumber(new Date(), nonce());
  const guestAccessToken = userId ? null : nonce() + nonce();

  // Reserve stock first: if any conditional update fails we have lost nothing,
  // because the order row is not written until every reservation succeeds.
  const reserved: { productId: string; size: string; quantity: number }[] = [];
  try {
    for (const line of active) {
      const result = await prisma.productSize.updateMany({
        where: {
          productId: line.productId,
          size: line.size,
          isActive: true,
          stock: { gte: line.quantity },
        },
        data: { stock: { decrement: line.quantity } },
      });
      if (result.count !== 1) {
        throw new OutOfStockError(
          `"${line.name}" in size ${line.size} just sold out. Please review your bag.`
        );
      }
      reserved.push({
        productId: line.productId,
        size: line.size,
        quantity: line.quantity,
      });

      await prisma.product.updateMany({
        where: { id: line.productId },
        data: { totalStock: { decrement: line.quantity } },
      });
    }
  } catch (err) {
    // Compensating release so a partial failure does not strand inventory.
    for (const r of reserved) {
      await prisma.productSize.updateMany({
        where: { productId: r.productId, size: r.size },
        data: { stock: { increment: r.quantity } },
      });
      await prisma.product.updateMany({
        where: { id: r.productId },
        data: { totalStock: { increment: r.quantity } },
      });
    }
    throw err;
  }

  try {
    const order = await prisma.order.create({
      data: {
        orderNumber,
        status: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        subtotal: totals.subtotal,
        discount: totals.discount,
        deliveryCharge: totals.deliveryCharge,
        taxAmount: totals.taxAmount,
        serviceCharge: totals.serviceCharge,
        total: totals.total,
        customerName: details.fullName,
        email: details.email,
        phone: details.phone,
        province: details.province,
        district: details.district,
        municipality: details.municipality,
        wardNumber: details.wardNumber || null,
        tole: details.tole || null,
        addressLine: details.addressLine,
        postalCode: details.postalCode || null,
        deliveryNotes: details.deliveryNotes || null,
        idempotencyKey,
        userId,
        // Guest orders get a second, high-entropy secret. The order id travels
        // in the URL and is therefore not treated as a capability on its own.
        guestAccessToken: userId ? null : guestAccessToken,
        items: {
          create: active.map((line) => {
            const product = productById.get(line.productId)!;
            return {
              productId: product.id,
              productName: product.name,
              productSlug: product.slug,
              productSku: product.sku,
              image: product.images[0] ?? null,
              size: line.size,
              colorName: product.colorName,
              unitPrice: effectivePrice(product.price, product.discountPrice),
              unitMrp: product.price,
              quantity: line.quantity,
              lineTotal: effectivePrice(product.price, product.discountPrice) * line.quantity,
              discount: Math.max(0, product.price - effectivePrice(product.price, product.discountPrice)) * line.quantity,
            };
          }),
        },
      },
      select: { id: true, orderNumber: true },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      guestAccessToken,
      totals,
    };
  } catch (err) {
    for (const r of reserved) {
      await prisma.productSize.updateMany({
        where: { productId: r.productId, size: r.size },
        data: { stock: { increment: r.quantity } },
      });
      await prisma.product.updateMany({
        where: { id: r.productId },
        data: { totalStock: { increment: r.quantity } },
      });
    }
    throw err;
  }
}

/** Restores reserved stock when an order is cancelled or payment permanently fails. */
export async function releaseOrderStock(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return;
  // Only orders that never completed a sale release stock back.
  if (order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_FAILED" && order.status !== "CANCELED") {
    return;
  }

  // Claim the release atomically. `updateMany` matches on the defaulted
  // `stockReleased: false`, so exactly one concurrent caller can win; everyone
  // else updates 0 rows and returns without touching stock. This is what makes
  // a replayed eSewa failure callback, a refresh of the failure URL, and a later
  // cancel all safe.
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, stockReleased: false },
    data: { stockReleased: true, stockReleasedAt: new Date() },
  });
  if (claimed.count === 0) return;

  for (const item of order.items) {
    if (!item.productId) continue;
    await prisma.productSize.updateMany({
      where: { productId: item.productId, size: item.size },
      data: { stock: { increment: item.quantity } },
    });
    await prisma.product.updateMany({
      where: { id: item.productId },
      data: { totalStock: { increment: item.quantity } },
    });
  }
}

/**
 * Allowed order status transitions. Guards the admin UI and any code that
 * changes status so an order cannot jump from DELIVERED back to PENDING.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "PAYMENT_FAILED", "CANCELED"],
  PAYMENT_FAILED: ["PENDING_PAYMENT", "CANCELED"],
  PAID: ["PROCESSING", "CANCELED", "REFUNDED"],
  PROCESSING: ["SHIPPED", "CANCELED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "CANCELED"],
  DELIVERED: ["REFUNDED"],
  CANCELED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

export const ORDER_STATUS_FLOW = TRANSITIONS;

export { PAISA };
