import "server-only";

import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/server/guards";
import type { OrderStatus, PaymentStatus } from "@/lib/constants";

/**
 * Read-side order queries for the storefront and account area.
 *
 * These are deliberately separate from `order.ts`, which owns writes. Every
 * function is owner-scoped, so an order id guessed by a customer returns null
 * rather than someone else's address and payment state. Guests additionally
 * have to present the high-entropy `guestAccessToken` cookie.
 */

const orderInclude = {
  items: { orderBy: { createdAt: "asc" as const } },
  payment: true,
} as const;

export interface OrderItemLine {
  id: string;
  productId: string | null;
  productName: string;
  productSlug: string;
  productSku: string;
  image: string | null;
  size: string;
  colorName: string | null;
  quantity: number;
  unitPrice: number;
  unitMrp: number;
  lineTotal: number;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  taxAmount: number;
  serviceCharge: number;
  total: number;
  currency: string;
  customerName: string;
  email: string;
  phone: string;
  province: string;
  district: string;
  municipality: string;
  wardNumber: string | null;
  tole: string | null;
  addressLine: string;
  postalCode: string | null;
  deliveryNotes: string | null;
  createdAt: Date;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  canceledAt: Date | null;
  items: OrderItemLine[];
  payment: {
    id: string;
    provider: string;
    status: string;
    amount: number;
    transactionUuid: string;
    transactionCode: string | null;
    gatewayStatus: string | null;
    failureReason: string | null;
    paidAt: Date | null;
  } | null;
}

type OrderRow = Awaited<ReturnType<typeof loadOrder>>;

/**
 * Prisma types the status columns as plain `String`, since the values are not
 * declared as enums in the schema. Narrow them to the domain unions so the UI
 * cannot be handed a status it does not understand.
 */
function toOrderDetail(row: Exclude<OrderRow, null> | null): OrderDetail | null {
  if (!row) return null;
  return {
    ...row,
    status: row.status as OrderStatus,
    paymentStatus: row.paymentStatus as PaymentStatus,
    payment: row.payment
      ? {
          id: row.payment.id,
          provider: row.payment.provider,
          status: row.payment.status,
          amount: row.payment.amount,
          transactionUuid: row.payment.transactionUuid,
          transactionCode: row.payment.transactionCode,
          gatewayStatus: row.payment.gatewayStatus,
          failureReason: row.payment.failureReason,
          paidAt: row.payment.paidAt,
        }
      : null,
  };
}

/** Compares two secrets without leaking their length relationship by timing. */
function secretsMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function loadOrder(id: string) {
  return prisma.order.findUnique({ where: { id }, include: orderInclude });
}

/** Owner-scoped read. Returns null when the order is not the caller's. */
export async function getOrderForUser(
  orderId: string,
  userId: string
): Promise<OrderDetail | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: orderInclude,
  });
  return toOrderDetail(order);
}

/**
 * Resolves the order for the confirmation / result pages, for either a signed-in
 * owner or a guest holding the matching access token.
 */
export async function getOrderForViewer(
  orderId: string,
  guestToken: string | null
): Promise<OrderDetail | null> {
  const order = await loadOrder(orderId);
  if (!order) return null;

  if (order.userId) {
    const user = await getCurrentUser();
    if (!user || user.id !== order.userId) return null;
    return toOrderDetail(order);
  }

  return secretsMatch(order.guestAccessToken, guestToken) ? toOrderDetail(order) : null;
}

/**
 * Same authorisation as {@link getOrderForViewer}, but keyed on the human
 * `orderNumber`.
 *
 * The eSewa callbacks redirect to the result page with the order number (that
 * is what appears in the gateway's own references), not the internal id, so
 * this is how that page reads the authoritative order state rather than
 * trusting the `status` query parameter the callback appended.
 */
export async function getOrderByNumberForViewer(
  orderNumber: string,
  guestToken: string | null
): Promise<OrderDetail | null> {
  if (!orderNumber) return null;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: orderInclude,
  });
  if (!order) return null;

  if (order.userId) {
    const user = await getCurrentUser();
    if (!user || user.id !== order.userId) return null;
    return toOrderDetail(order);
  }

  return secretsMatch(order.guestAccessToken, guestToken) ? toOrderDetail(order) : null;
}

/** Owner-scoped read keyed on the human `orderNumber`, as used in account URLs. */
export async function getOrderByNumberForUser(
  orderNumber: string,
  userId: string
): Promise<OrderDetail | null> {
  if (!orderNumber) return null;
  const order = await prisma.order.findFirst({
    where: { orderNumber, userId },
    include: orderInclude,
  });
  return toOrderDetail(order);
}

export interface UserOrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  currency: string;
  itemCount: number;
  thumbnail: string | null;
  createdAt: Date;
  items: { productName: string; quantity: number; size: string }[];
}

/** Paginated order history for the signed-in customer. */
export async function listUserOrders(
  page = 1,
  perPage = 10
): Promise<{ orders: UserOrderSummary[]; total: number; totalPages: number; page: number }> {
  const user = await getCurrentUser();
  if (!user) {
    return { orders: [], total: 0, totalPages: 1, page: 1 };
  }

  const safePage = Math.max(1, page);
  const safePerPage = Math.min(50, Math.max(1, perPage));

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      include: {
        items: {
          select: {
            productName: true,
            quantity: true,
            size: true,
            image: true,
          },
        },
      },
    }),
    prisma.order.count({ where: { userId: user.id } }),
  ]);

  return {
    page: safePage,
    total,
    totalPages: Math.max(1, Math.ceil(total / safePerPage)),
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status as OrderStatus,
      paymentStatus: o.paymentStatus as PaymentStatus,
      total: o.total,
      currency: o.currency,
      itemCount: o.items.reduce((sum: number, i: { quantity: number }) => sum + i.quantity, 0),
      thumbnail: o.items.find((i: { image: string | null }) => i.image)?.image ?? null,
      createdAt: o.createdAt,
      items: o.items.map((i: { productName: string; quantity: number; size: string }) => ({
        productName: i.productName,
        quantity: i.quantity,
        size: i.size,
      })),
    })),
  };
}

export async function countUserOrders(userId: string): Promise<number> {
  return prisma.order.count({ where: { userId } });
}
