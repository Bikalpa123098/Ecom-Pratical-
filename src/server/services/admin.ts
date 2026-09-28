import "server-only";

import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  effectivePrice,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/constants";
import { prisma } from "@/lib/db";

/**
 * Admin reads.
 *
 * Every function here is called from a page or action that has already passed
 * `requireAdmin()`. Keeping the queries in one place makes it obvious which
 * fields an admin surface is allowed to expose.
 */

export interface AdminDashboard {
  revenuePaidPaisa: number;
  ordersTotal: number;
  ordersPaid: number;
  ordersPending: number;
  ordersUnpaid: number;
  productsActive: number;
  productsLowStock: number;
  outOfStock: number;
  customers: number;
  recentOrders: {
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    createdAt: Date;
  }[];
  lowStock: {
    productId: string;
    name: string;
    slug: string;
    size: string;
    stock: number;
  }[];
  recentPayments: {
    id: string;
    orderNumber: string;
    transactionUuid: string;
    transactionCode: string | null;
    gatewayStatus: string | null;
    status: string;
    createdAt: Date;
  }[];
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const [
    revenue,
    ordersTotal,
    ordersPaid,
    ordersPending,
    productsActive,
    customers,
    recentOrders,
    lowStockRows,
    recentPayments,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { paymentStatus: "PAID" },
      _sum: { total: true },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { paymentStatus: "PAID" } }),
    prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.user.count(),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
    }),
    prisma.productSize.findMany({
      where: { isActive: true, stock: { lte: 5 } },
      orderBy: { stock: "asc" },
      take: 10,
      select: { stock: true, size: true, product: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        transactionUuid: true,
        transactionCode: true,
        gatewayStatus: true,
        status: true,
        createdAt: true,
        order: { select: { orderNumber: true } },
      },
    }),
  ]);

  // A size row with stock 0 is a size that exists but is sold out, so it is
  // reported separately from "low but buyable".
  const outOfStock = lowStockRows.filter((row) => row.stock === 0).length;

  return {
    revenuePaidPaisa: revenue._sum.total ?? 0,
    ordersTotal,
    ordersPaid,
    ordersPending,
    ordersUnpaid: ordersTotal - ordersPaid,
    productsActive,
    productsLowStock: lowStockRows.filter((row) => row.stock > 0).length,
    outOfStock,
    customers,
    recentOrders: recentOrders.map((o) => ({
      ...o,
      status: o.status as OrderStatus,
      paymentStatus: o.paymentStatus as PaymentStatus,
    })),
    lowStock: lowStockRows.map((row) => ({
      productId: row.product.id,
      name: row.product.name,
      slug: row.product.slug,
      size: row.size,
      stock: row.stock,
    })),
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      orderNumber: p.order.orderNumber,
      transactionUuid: p.transactionUuid,
      transactionCode: p.transactionCode,
      gatewayStatus: p.gatewayStatus,
      status: p.status,
      createdAt: p.createdAt,
    })),
  };
}

export interface AdminOrderListItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  district: string;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  itemCount: number;
  createdAt: Date;
}

export async function listAdminOrders(input: {
  page?: number;
  status?: string;
  paymentStatus?: string;
  q?: string;
  perPage?: number;
}): Promise<{ orders: AdminOrderListItem[]; total: number; totalPages: number; page: number }> {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 20));

  // Unknown filter values are ignored rather than passed through to the query,
  // so a hand-edited URL cannot widen the result set.
  const status = ORDER_STATUSES.includes(input.status as OrderStatus)
    ? (input.status as OrderStatus)
    : undefined;
  const paymentStatus = PAYMENT_STATUSES.includes(input.paymentStatus as PaymentStatus)
    ? (input.paymentStatus as PaymentStatus)
    : undefined;

  const where = {
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(input.q
      ? {
          OR: [
            { orderNumber: { contains: input.q, mode: "insensitive" as const } },
            { customerName: { contains: input.q, mode: "insensitive" as const } },
            { phone: { contains: input.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { items: { select: { quantity: true } } },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    page,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    orders: rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerEmail: o.email,
      district: o.district,
      total: o.total,
      status: o.status as OrderStatus,
      paymentStatus: o.paymentStatus as PaymentStatus,
      itemCount: o.items.reduce((sum: number, i: { quantity: number }) => sum + i.quantity, 0),
      createdAt: o.createdAt,
    })),
  };
}

export interface AdminProductListItem {
  id: string;
  name: string;
  slug: string;
  sku: string;
  status: string;
  price: number;
  effective: number;
  totalStock: number;
  categoryName: string;
  brandName: string;
  updatedAt: Date;
}

export async function listAdminProducts(input: {
  page?: number;
  q?: string;
  status?: string;
  perPage?: number;
}): Promise<{ products: AdminProductListItem[]; total: number; totalPages: number; page: number }> {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 20));

  const where = {
    ...(input.status === "ACTIVE" || input.status === "DRAFT" || input.status === "ARCHIVED"
      ? { status: input.status }
      : {}),
    ...(input.q
      ? {
          OR: [
            // Escaped for the MongoDB `$regex` that `contains` compiles to, so
            // a metacharacter in the search box cannot become syntax.
            { name: { contains: escapeRegExp(input.q), mode: "insensitive" as const } },
            { sku: { contains: escapeRegExp(input.q), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    page,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    products: rows.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      status: p.status,
      price: p.price,
      effective: effectivePrice(p.price, p.discountPrice),
      totalStock: p.totalStock,
      categoryName: p.category.name,
      brandName: p.brand.name,
      updatedAt: p.updatedAt,
    })),
  };
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  orderCount: number;
  createdAt: Date;
}

export async function listAdminUsers(input: {
  page?: number;
  q?: string;
  perPage?: number;
}): Promise<{ users: AdminUserListItem[]; total: number; totalPages: number; page: number }> {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 20));

  const where = input.q
    ? {
        OR: [
          { name: { contains: escapeRegExp(input.q), mode: "insensitive" as const } },
          { email: { contains: escapeRegExp(input.q), mode: "insensitive" as const } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { _count: { select: { orders: true } } },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    page,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    users: rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
      orderCount: u._count.orders,
      createdAt: u.createdAt,
    })),
  };
}

/** Escapes a needle before it is handed to Prisma's MongoDB `contains`. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
