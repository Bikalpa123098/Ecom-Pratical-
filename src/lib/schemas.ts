import { z } from "zod";
import {
  CATEGORY_KINDS,
  GENDERS,
  ORDER_STATUSES,
  PRODUCT_SORTS,
  PRODUCT_STATUSES,
} from "@/lib/constants";
import { NEPAL_PROVINCES } from "@/lib/geo";

/**
 * Shared validation schemas. These are the ONLY accepted shape for user input:
 * every server action and route handler parses through one of these before
 * touching the database or building a payment request.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Nepali mobile numbers: 10 digits starting 96/97/98.
 * Accepts common formats like "+977 98XXXXXXXX", "977-98XXXXXXXX", "0-98XXXXXXXX".
 * Strips spaces, dashes and the +977/977/0 prefix before validating.
 */
export const nepalPhoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-]/g, ""))
  .transform((v) => {
    // Strip common prefixes: +977, 977, 0
    if (v.startsWith("+977")) return v.slice(4);
    if (v.startsWith("977")) return v.slice(3);
    if (v.startsWith("0") && v.length === 11) return v.slice(1);
    return v;
  })
  .refine((v) => /^9[678]\d{8}$/.test(v), {
    message: "Enter a valid Nepali mobile number (98XXXXXXXX).",
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254);

export const cuidSchema = z.string().trim().min(1).max(64);

/** A product size as stored on ProductSize.size (e.g. "40", "UK 8", "7.5"). */
export const sizeSchema = z
  .string()
  .trim()
  .min(1, "Select a size.")
  .max(16);

export const quantitySchema = z
  .number()
  .int("Quantity must be a whole number.")
  .min(1, "Quantity must be at least 1.")
  .max(20, "You can order at most 20 of a single size.");

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Password policy, shared by the Zod schema and the client-side hint text. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RULE_TEXT =
  `At least ${PASSWORD_MIN_LENGTH} characters, with an uppercase letter, a lowercase letter and a number.`;

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: emailSchema,
  phone: nepalPhoneSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
  callbackUrl: z.string().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: nepalPhoneSchema,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

export const provinceSchema = z.enum(NEPAL_PROVINCES, {
  message: "Select a province.",
});

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(40).default("Home"),
  fullName: z.string().trim().min(2, "Enter the recipient's name.").max(80),
  phone: nepalPhoneSchema,
  email: emailSchema.optional().or(z.literal("")),
  province: provinceSchema,
  // Free text with suggestions: the national local-level list is revised under
  // the Local Government Act, so a hard-coded list would block new areas.
  district: z.string().trim().min(2, "Enter a district.").max(60),
  municipality: z.string().trim().min(2, "Enter a municipality or city.").max(80),
  wardNumber: z.string().trim().max(10).optional().or(z.literal("")),
  tole: z.string().trim().max(80).optional().or(z.literal("")),
  addressLine: z.string().trim().min(4, "Enter the full delivery address.").max(200),
  postalCode: z.string().trim().max(10).optional().or(z.literal("")),
  deliveryNotes: z.string().trim().max(300).optional().or(z.literal("")),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressSchema>;

// ---------------------------------------------------------------------------
// Cart & wishlist
// ---------------------------------------------------------------------------

export const addToCartSchema = z.object({
  productId: cuidSchema,
  size: sizeSchema,
  quantity: quantitySchema.default(1),
});
export type AddToCartInput = z.infer<typeof addToCartSchema>;

export const updateCartItemSchema = z.object({
  itemId: cuidSchema,
  quantity: quantitySchema,
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const removeCartItemSchema = z.object({ itemId: cuidSchema });

export const cartLineSchema = z.object({
  productId: cuidSchema,
  size: sizeSchema,
  quantity: quantitySchema,
});
export type CartLineInput = z.infer<typeof cartLineSchema>;

export const wishlistToggleSchema = z.object({ productId: cuidSchema });

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

/**
 * Checkout input contains ONLY identity, contact and delivery details plus the
 * chosen payment method. It deliberately carries no prices, no totals and no
 * product data: the server recomputes all money from the database, so a
 * tampered payload cannot change what the customer is charged.
 */
export const checkoutSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(80),
  email: emailSchema,
  phone: nepalPhoneSchema,
  province: provinceSchema,
  district: z.string().trim().min(2, "Select a district.").max(60),
  municipality: z.string().trim().min(2, "Enter a municipality or city.").max(80),
  wardNumber: z.string().trim().max(10).optional().or(z.literal("")),
  tole: z.string().trim().max(80).optional().or(z.literal("")),
  addressLine: z.string().trim().min(4, "Enter the full delivery address.").max(200),
  postalCode: z.string().trim().max(10).optional().or(z.literal("")),
  deliveryNotes: z.string().trim().max(300).optional().or(z.literal("")),
  saveAddress: z.boolean().default(false),
  paymentMethod: z.literal("ESEWA").default("ESEWA"),
  /**
   * Client-generated key so a double-clicked "Pay with eSewa" cannot create two
   * orders. Constrained to a safe character set because it is persisted.
   */
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "Invalid checkout session.")
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid checkout session."),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

// ---------------------------------------------------------------------------
// Product listing (query params)
// ---------------------------------------------------------------------------

const csvArray = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) =>
      v ? v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, max) : []
    );

export const productQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  category: csvArray(20),
  brand: csvArray(20),
  gender: z
    .string()
    .optional()
    .transform((v) =>
      v ? v.split(",").filter((s) => (GENDERS as readonly string[]).includes(s)) : []
    ),
  size: csvArray(20),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  onSale: z.coerce.boolean().optional(),
  inStock: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  sort: z.enum(PRODUCT_SORTS).optional().default("newest"),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(60).optional().default(24),
});
export type ProductQuery = z.infer<typeof productQuerySchema>;

// ---------------------------------------------------------------------------
// Admin: product
// ---------------------------------------------------------------------------

/** Money arrives from admin forms as rupees; stored as paisa. */
const rupeesToPaisa = z.coerce
  .number()
  .min(0, "Price cannot be negative.")
  .max(10_000_000, "Price is unrealistically high.")
  .transform((v) => Math.round(v * 100));

const optionalRupeesToPaisa = z
  .union([z.literal(""), z.coerce.number().min(0).max(10_000_000)])
  .transform((v) => (v === "" || v === 0 ? null : Math.round(v * 100)))
  .nullable();

export const sizeStockSchema = z.object({
  size: sizeSchema,
  stock: z.coerce.number().int().min(0, "Stock cannot be negative.").max(100_000),
  isActive: z.boolean().default(true),
});

export const productFormSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a product name.").max(120),
    // A blank input is how the form says "generate this for me"; the action falls
    // back to slugify(name) and a derived SKU. `.optional()` alone is not enough
    // because a blank field submits "" (a string, so it passes `.optional()` and
    // then trips `.min(2)`), which would make the fallback unreachable.
    slug: z
      .string()
      .trim()
      .min(2, "Enter a URL slug.")
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may contain lowercase letters, numbers and hyphens only.")
      .optional()
      .or(z.literal("")),
    sku: z
      .string()
      .trim()
      .min(2, "Enter a SKU.")
      .max(40)
      .regex(/^[A-Za-z0-9._-]+$/, "SKU may contain letters, numbers, dot, underscore and hyphen only.")
      .optional()
      .or(z.literal("")),
    description: z.string().trim().min(10, "Enter a description.").max(4000),
    shortDescription: z.string().trim().max(240).optional().or(z.literal("")),
    price: rupeesToPaisa,
    discountPrice: optionalRupeesToPaisa,
    imagesText: z
      .string()
      .trim()
      .min(1, "Add at least one image URL.")
      .max(4000)
      .transform((v) =>
        v
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
      // Products store their images as site-relative paths ("/images/..."), so
      // `z.url()` alone would reject every seeded product. Absolute URLs are
      // allowed too, and anything else is refused so a typo cannot become a
      // broken <Image> src in production.
      .pipe(
        z
          .array(
            z
              .string()
              .trim()
              .min(1, "Each image must be a valid URL.")
              .refine(
                (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
                "Each image must be a site-relative path or an absolute URL."
              )
          )
          .min(1, "Add at least one image URL.")
          .max(12)
      ),
    brandId: cuidSchema,
    categoryId: cuidSchema,
    gender: z.enum(GENDERS, { message: "Select a gender." }),
    colorName: z.string().trim().max(40).optional().or(z.literal("")),
    colorHex: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour such as #1f2937.")
      .optional()
      .or(z.literal("")),
    material: z.string().trim().max(60).optional().or(z.literal("")),
    tagsText: z
      .string()
      .trim()
      .max(300)
      .optional()
      .transform((v) =>
        v
          ? v
              .split(",")
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean)
              .slice(0, 12)
          : []
      ),
    status: z.enum(PRODUCT_STATUSES).default("ACTIVE"),
    featured: z.coerce.boolean().default(false),
    sizes: z
      .array(sizeStockSchema)
      .min(1, "Add at least one size.")
      .max(40)
      .refine(
        (sizes) => new Set(sizes.map((s) => s.size)).size === sizes.length,
        { message: "Each size may only be listed once." }
      ),
  })
  .refine(
    (v) => v.discountPrice === null || v.discountPrice < v.price,
    { message: "Discount price must be lower than the price.", path: ["discountPrice"] }
  );
export type ProductFormInput = z.infer<typeof productFormSchema>;

// ---------------------------------------------------------------------------
// Admin: category, brand, order, user
// ---------------------------------------------------------------------------

export const categoryFormSchema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(60),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only.")
    .optional(),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  image: z.union([z.literal(""), z.url("Enter a valid image URL.")]).optional(),
  kind: z.enum(CATEGORY_KINDS).default("SHOES"),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});
export type CategoryFormInput = z.infer<typeof categoryFormSchema>;

export const brandFormSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only.")
    .optional(),
  logo: z.union([z.literal(""), z.url("Enter a valid logo URL.")]).optional(),
  isActive: z.coerce.boolean().default(true),
});
export type BrandFormInput = z.infer<typeof brandFormSchema>;

export const adminOrderStatusSchema = z.object({
  orderId: cuidSchema,
  status: z.enum(ORDER_STATUSES, { message: "Select a valid status." }),
  internalNote: z.string().trim().max(500).optional(),
});

export const adminUserRoleSchema = z.object({
  userId: cuidSchema,
  role: z.enum(["CUSTOMER", "ADMIN"]),
});

export const adminUserActiveSchema = z.object({
  userId: cuidSchema,
  isActive: z.coerce.boolean(),
});

export const stockAdjustSchema = z.object({
  productId: cuidSchema,
  size: sizeSchema,
  stock: z.coerce.number().int().min(0).max(100_000),
});
