"use server";

/**
 * Admin mutations.
 *
 * Every action calls `assertAdmin()` first, so authorisation cannot be forgotten
 * by a caller. Prices, stock and status are validated against the schema and
 * applied to the database; the browser never supplies an amount it can then read
 * back as authoritative.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { effectivePrice } from "@/lib/constants";
import {
  adminOrderStatusSchema,
  adminUserActiveSchema,
  adminUserRoleSchema,
  productFormSchema,
  stockAdjustSchema,
} from "@/lib/schemas";
import { assertAdmin } from "@/server/guards";
import { releaseOrderStock } from "@/server/services/order";
import { fieldErrorsFrom } from "@/server/validation";
import { reconcileStuckOrders } from "@/server/services/payment";

export interface AdminState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

export async function updateOrderStatusAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const admin = await assertAdmin();

  const parsed = adminOrderStatusSchema.safeParse({
    orderId: formData.get("orderId"),
    status: formData.get("status"),
    internalNote: formData.get("internalNote") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted fields.",
      errors: fieldErrorsFrom(parsed.error),
    };
  }

  const { orderId, status, internalNote } = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, paymentStatus: true, stockReleased: true, shippedAt: true },
  });
  if (!order) return { ok: false, message: "That order could not be found." };

  // A paid order cannot silently become cancelled, or vice versa: both change
  // what the customer is owed, so they go through the payment flow instead.
  if (order.paymentStatus === "PAID" && status === "CANCELED") {
    return {
      ok: false,
      message:
        "This order is already paid. Refund it through the payment record instead of cancelling.",
    };
  }

  const now = new Date();
  const patch: Record<string, unknown> = { status };
  // Each timestamp is stamped the first time the status is reached, so a later
  // unrelated status change does not overwrite the original event.
  if (status === "SHIPPED" && order.shippedAt === null) patch.shippedAt = now;
  if (status === "DELIVERED") patch.deliveredAt = now;
  if (status === "CANCELED") patch.canceledAt = now;
  if (internalNote) patch.internalNote = internalNote;

  await prisma.order.update({ where: { id: orderId }, data: patch });

  // Cancelling puts the reserved stock back on the shelf. The service is
  // idempotent, so a second cancel is harmless.
  if (status === "CANCELED" && !order.stockReleased) {
    await releaseOrderStock(orderId);
  }

  console.info("[admin] order status changed", {
    orderId,
    from: order.status,
    to: status,
    by: admin.id,
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, message: `Order marked ${status.toLowerCase().replace(/_/g, " ")}.` };
}

export async function adjustStockAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await assertAdmin();

  const parsed = stockAdjustSchema.safeParse({
    productId: formData.get("productId"),
    size: formData.get("size"),
    stock: formData.get("stock"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted fields.",
      errors: fieldErrorsFrom(parsed.error),
    };
  }

  const { productId, size, stock } = parsed.data;

  const variant = await prisma.productSize.findFirst({
    where: { productId, size },
    select: { id: true, stock: true },
  });
  if (!variant) {
    return { ok: false, message: `Size ${size} does not exist for this product.` };
  }

  const delta = stock - variant.stock;
  if (delta === 0) return { ok: true, message: "Stock is already correct." };

  // Both rows are written to keep the denormalised product total in step; the
  // per-size row is the source of truth.
  await prisma.$transaction([
    prisma.productSize.update({ where: { id: variant.id }, data: { stock } }),
    prisma.product.update({
      where: { id: productId },
      data: { totalStock: { increment: delta } },
    }),
  ]);

  revalidatePath("/admin/products");
  return {
    ok: true,
    message: `Size ${size} set to ${stock} (${delta > 0 ? "+" : ""}${delta}).`,
  };
}

export async function saveProductAction(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await assertAdmin();

  const id = formData.get("id")?.toString() || null;

  const parsed = productFormSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") ?? "",
    sku: formData.get("sku") ?? "",
    description: formData.get("description"),
    shortDescription: formData.get("shortDescription") ?? "",
    price: formData.get("price"),
    discountPrice: formData.get("discountPrice") ?? "",
    imagesText: formData.get("images") ?? "",
    brandId: formData.get("brandId"),
    categoryId: formData.get("categoryId"),
    gender: formData.get("gender"),
    colorName: formData.get("colorName") ?? "",
    colorHex: formData.get("colorHex") ?? "",
    material: formData.get("material") ?? "",
    tagsText: formData.get("tags") ?? "",
    status: formData.get("status"),
    featured: formData.get("featured") === "on" || formData.get("featured") === "true",
    // The form renders each size as a pair of inputs (a size box next to a stock
    // box), so the two name lists are zipped by index. A row with a blank size
    // and zero stock is one of the form's spare rows, not a real variant, so it
    // is dropped instead of being validated as an empty size.
    sizes: formData
      .getAll("sizes")
      .map((size, index) => ({
        size: String(size).trim(),
        stock: String(formData.getAll("stock")[index] ?? "0").trim(),
      }))
      .filter((row) => row.size !== ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted fields.",
      errors: fieldErrorsFrom(parsed.error),
    };
  }

  const data = parsed.data;
  // A blank slug falls back to one derived from the name, so an admin only has to
  // think about URLs when they want something other than the obvious.
  const slug = data.slug || slugify(data.name);
  const sku = data.sku || `BKL-${slug.toUpperCase().slice(0, 12)}`;

  const clash = await prisma.product.findFirst({
    where: { slug, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (clash) {
    return {
      ok: false,
      message: "That URL slug is already used by another product.",
      errors: { slug: "Already in use." },
    };
  }

  // `sortPrice` mirrors the effective price; the product service sorts and
  // range-filters on it, so it must never be left at the default.
  const sortPrice = effectivePrice(data.price, data.discountPrice);
  const totalStock = data.sizes.reduce((sum, row) => sum + row.stock, 0);

  const scalar = {
    name: data.name,
    slug,
    sku,
    description: data.description,
    shortDescription: data.shortDescription || null,
    price: data.price,
    discountPrice: data.discountPrice,
    sortPrice,
    images: data.imagesText,
    gender: data.gender,
    colorName: data.colorName || null,
    colorHex: data.colorHex || null,
    material: data.material || null,
    tags: data.tagsText,
    status: data.status,
    featured: data.featured,
    totalStock,
    categoryId: data.categoryId,
    brandId: data.brandId,
  };

  if (id) {
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!existing) return { ok: false, message: "That product could not be found." };

    await prisma.product.update({ where: { id }, data: scalar });

    // Sizes are the source of truth for stock, so the size list is replaced
    // wholesale rather than merged: a size the admin removed must stop selling.
    await prisma.productSize.deleteMany({ where: { productId: id } });
    if (data.sizes.length > 0) {
      await prisma.productSize.createMany({
        data: data.sizes.map((row) => ({
          productId: id,
          size: row.size,
          stock: row.stock,
          isActive: true,
        })),
      });
    }

    revalidatePath("/admin/products");
    revalidatePath(`/products/${slug}`);
    if (existing.slug !== slug) revalidatePath(`/products/${existing.slug}`);
    return { ok: true, message: `${data.name} updated.` };
  }

  const created = await prisma.product.create({ data: { ...scalar, slug } });
  if (data.sizes.length > 0) {
    await prisma.productSize.createMany({
      data: data.sizes.map((row) => ({
        productId: created.id,
        size: row.size,
        stock: row.stock,
        isActive: true,
      })),
    });
  }

  revalidatePath("/admin/products");
  return { ok: true, message: `${data.name} created.` };
}

/** Lowercase, hyphenated, ASCII-only URL slug. */
function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug.length >= 2 ? slug : `product-${Date.now().toString(36)}`;
}

export async function setUserRoleAction(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const parsed = adminUserRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/admin/users");

  // Guard against an admin locking every administrator out of the dashboard.
  if (parsed.data.userId === admin.id && parsed.data.role !== "ADMIN") {
    redirect("/admin/users?error=self-demote");
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { role: parsed.data.role },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function setUserActiveAction(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const parsed = adminUserActiveSchema.safeParse({
    userId: formData.get("userId"),
    isActive: formData.get("isActive") === "true" || formData.get("isActive") === "on",
  });
  if (!parsed.success) redirect("/admin/users");

  if (parsed.data.userId === admin.id) {
    redirect("/admin/users?error=self-deactivate");
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { isActive: parsed.data.isActive },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

/** Manual sweep for orders stuck in PENDING_PAYMENT. Admin-only. */
export async function reconcilePaymentsAction(): Promise<void> {
  await assertAdmin();
  await reconcileStuckOrders();
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  redirect("/admin?reconciled=1");
}
