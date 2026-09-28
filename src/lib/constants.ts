// Shared, dependency-free domain constants.
// Prisma + MongoDB cannot express enums, so these unions are the single source
// of truth for every status/role stored as a String.

// ---------------------------------------------------------------------------
// Roles & statuses
// ---------------------------------------------------------------------------

export const USER_ROLES = ["CUSTOMER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELED",
  "PAYMENT_FAILED",
  "REFUNDED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pending Payment",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELED: "Canceled",
  PAYMENT_FAILED: "Payment Failed",
  REFUNDED: "Refunded",
};

export const PAYMENT_STATUSES = [
  "PENDING",
  "PAID",
  "FAILED",
  "AMBIGUOUS",
  "CANCELED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  AMBIGUOUS: "Ambiguous",
  CANCELED: "Canceled",
  PARTIALLY_REFUNDED: "Partially Refunded",
  REFUNDED: "Refunded",
};

export const PRODUCT_STATUSES = ["ACTIVE", "DRAFT", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const GENDERS = ["MEN", "WOMEN", "UNISEX", "KIDS"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  MEN: "Men",
  WOMEN: "Women",
  UNISEX: "Unisex",
  KIDS: "Kids",
};

export const CATEGORY_KINDS = [
  "SHOES",
  "SANDALS",
  "SLIPPERS",
  "BOOTS",
  "ACCESSORIES",
] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/** eSewa's own transaction-status vocabulary, verbatim from the docs. */
export const ESEWA_TRANSACTION_STATUSES = [
  "PENDING",
  "COMPLETE",
  "FULL_REFUND",
  "PARTIAL_REFUND",
  "AMBIGUOUS",
  "NOT_FOUND",
  "CANCELED",
] as const;
export type EsewaTransactionStatus = (typeof ESEWA_TRANSACTION_STATUSES)[number];

/** Payment.status values we persist, mapped from the eSewa vocabulary above. */
export const PAYMENT_RECORD_STATUSES = [
  "PENDING",
  "COMPLETE",
  "FULL_REFUND",
  "PARTIAL_REFUND",
  "AMBIGUOUS",
  "NOT_FOUND",
  "CANCELED",
  "FAILED",
  "EXPIRED",
] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export const PRODUCT_SORTS = [
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "name_asc",
  "name_desc",
  "popular",
  "rating",
  "discount",
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  name_asc: "Name: A to Z",
  name_desc: "Name: Z to A",
  popular: "Best selling",
  rating: "Top rated",
  discount: "Biggest discount",
};

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

/** Paisa per rupee. All money in this codebase is integer paisa. */
export const PAISA = 100;

export function toPaisa(rupees: number): number {
  return Math.round(rupees * PAISA);
}

export function toRupees(paisa: number): number {
  return paisa / PAISA;
}

/**
 * eSewa expects a plain decimal string with no currency symbol, grouping or
 * trailing noise. We send the shortest exact representation so that the string
 * we sign is byte-identical to the string eSewa stores and echoes back.
 */
export function paisaToEsewaAmount(paisa: number): string {
  if (!Number.isFinite(paisa) || !Number.isInteger(paisa) || paisa < 0) {
    throw new RangeError(`paisaToEsewaAmount: expected a non-negative integer, got ${paisa}`);
  }
  const rupees = paisa / PAISA;
  return Number.isInteger(rupees) ? String(rupees) : String(Number(rupees.toFixed(2)));
}

/** Parses a possibly-formatted eSewa amount ("1000", 1000.0, "1000.00") to paisa. */
export function esewaAmountToPaisa(value: string | number): number {
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) throw new RangeError(`esewaAmountToPaisa: not a number: ${value}`);
  return Math.round(n * PAISA);
}

export function formatNPR(paisa: number): string {
  const sign = paisa < 0 ? "-" : "";
  const abs = Math.abs(Math.round(paisa));
  const whole = Math.floor(abs / PAISA);
  const fraction = abs % PAISA;
  const grouped = whole.toLocaleString("en-IN");
  return fraction === 0
    ? `${sign}Rs. ${grouped}`
    : `${sign}Rs. ${grouped}.${String(fraction).padStart(2, "0")}`;
}

export function formatDiscountPercent(price: number, discountPrice: number | null): number | null {
  if (!discountPrice || discountPrice >= price || price <= 0) return null;
  return Math.round(((price - discountPrice) / price) * 100);
}

/** The price a customer actually pays. */
export function effectivePrice(price: number, discountPrice: number | null): number {
  if (discountPrice && discountPrice > 0 && discountPrice < price) return discountPrice;
  return price;
}

// ---------------------------------------------------------------------------
// Order numbering
// ---------------------------------------------------------------------------

/** eSewa's transaction_uuid accepts only alphanumeric and hyphen. */
export function buildTransactionUuid(prefix = "BKL", now = new Date(), nonce: string): string {
  const d = now;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const stamp =
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
  return `${prefix}-${stamp}-${nonce}`;
}

export function buildOrderNumber(now = new Date(), nonce: string): string {
  const d = now;
  const p = (n: number) => String(n).padStart(2, "0");
  return `BKL-${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${nonce}`;
}

const ALPHANUM_HYPHEN = /^[A-Za-z0-9-]+$/;

/** Enforces eSewa's transaction_uuid character contract. */
export function assertValidTransactionUuid(value: string): string {
  if (!ALPHANUM_HYPHEN.test(value)) {
    throw new Error(
      `Invalid transaction_uuid "${value}": only alphanumeric characters and hyphen are allowed.`
    );
  }
  if (value.length > 64) {
    throw new Error(`Invalid transaction_uuid: too long (${value.length} > 64).`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

/** Identifies an anonymous browser's server-side cart. */
export const GUEST_CART_COOKIE = "bkl_guest_cart";
/**
 * Authorises a guest to read their own order. The order id alone is only
 * 96 bits of ObjectId entropy and appears in URLs, so a separate secret is
 * required before any guest order detail is rendered.
 */
export const GUEST_ORDER_COOKIE = "bkl_guest_order";
/** Remembers whether the visitor has already been shown the cookie notice. */
export const CONSENT_COOKIE = "bkl_notice";
