/**
 * Seeds the catalogue and the first administrator.
 *
 * Idempotent: categories, brands and products are upserted by slug, so running
 * it repeatedly refreshes stock and prices without creating duplicates. Orders,
 * carts and payments are never touched.
 *
 * The catalogue is reconciled, not just upserted: anything not listed below is
 * removed (products) or deactivated (brands, categories), so replacing the
 * catalogue does not leave stale rows behind. Deleting a product is safe for
 * sales history because `OrderItem.productId` is `onDelete: SetNull` and each
 * line keeps its own name/price/image snapshot.
 *
 * Money is written in paisa via `R()`, which takes rupees.
 *
 * Product photographs come from Wikimedia Commons and are stored under
 * `public/images/products`. Each is freely licensed; see IMAGE_CREDITS below.
 * They are placeholders standing in for real catalogue photography, and the
 * brand names are used here only to identify the model being demoed.
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

/** Rupees -> paisa. Keeps the seed readable. */
const R = (rupees: number): number => Math.round(rupees * 100);

/** Generates a random 16-character password with mixed case, digits and symbols. */
function generateSecurePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const chars: string[] = Array.from(bytes, (b) => all[b % all.length]!);
  // Guarantee at least one of each class
  chars[0] = upper[bytes[0]! % upper.length]!;
  chars[1] = lower[bytes[1]! % lower.length]!;
  chars[2] = digits[bytes[2]! % digits.length]!;
  chars[3] = symbols[bytes[3]! % symbols.length]!;
  return chars.join("");
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { name: "Sneakers", slug: "sneakers", kind: "SHOES", sortOrder: 1 },
];

const BRANDS = [
  { name: "adidas", slug: "adidas" },
  { name: "Converse", slug: "converse" },
  { name: "Nike", slug: "nike" },
  { name: "New Balance", slug: "new-balance" },
  { name: "Vans", slug: "vans" },
  { name: "Puma", slug: "puma" },
];

/**
 * Attribution for the bundled photographs. Every image is freely licensed, and
 * the licences below require or expect credit.
 */
const IMAGE_CREDITS: Record<string, { file: string; license: string }> = {
  "/images/products/adidas-samba-1.jpg": {
    file: "Adidas Samba sneakers, Originals branch",
    license: "public domain",
  },
  "/images/products/converse-chuck-1.jpg": {
    file: "Converse All Star, black leather",
    license: "CC BY-SA 4.0",
  },
  "/images/products/nike-af1-1.jpg": {
    file: "Air Force 1",
    license: "CC0",
  },
  "/images/products/new-balance-550-1.jpg": {
    file: "New Balance 550",
    license: "CC0",
  },
  "/images/products/vans-old-skool-1.jpg": {
    file: "Old Skool",
    license: "CC BY 2.0",
  },
  "/images/products/puma-suede-1.jpg": {
    file: "Puma Suede",
    license: "CC0",
  },
};

const ADULT_SIZES = ["39", "40", "41", "42", "43", "44", "45"];

const PRODUCTS = [
  {
    name: "adidas Samba OG",
    slug: "adidas-samba-og",
    sku: "ADD-SAM-0001",
    brand: "adidas",
    category: "sneakers",
    gender: "UNISEX",
    price: R(12000),
    discountPrice: R(9500),
    colorName: "Cloud White / Core Black",
    colorHex: "#f4f4f2",
    material: "Leather upper, serrated 3-stripes, gum rubber outsole",
    featured: true,
    tags: ["samba", "terrace", "retro", "gum-sole", "leather"],
    shortDescription: "The terrace shoe that took over the street, in leather.",
    description:
      "The Samba has been around since the 1940s as an indoor football shoe, and the gum-soled leather version is the one that ended up everywhere. Soft full-grain leather upper, the serrated three-stripes that make it unmistakable, and a sticky gum outsole that grips smooth indoor floors and city pavements equally well. Low profile, lightly padded collar, and a shape that works with everything from jeans to a suit.",
    images: ["/images/products/adidas-samba-1.jpg"],
    sizes: ADULT_SIZES.map((size) => ({ size, stock: 10 + (Number(size) % 6) })),
  },
  {
    name: "Converse Chuck Taylor All Star Canvas Hi",
    slug: "converse-chuck-taylor-all-star-hi",
    sku: "CNV-CKT-0001",
    brand: "converse",
    category: "sneakers",
    gender: "UNISEX",
    price: R(8500),
    discountPrice: null,
    colorName: "Optical White",
    colorHex: "#fbfbf9",
    material: "Cotton canvas upper, vulcanised rubber sole",
    featured: true,
    tags: ["high-top", "canvas", "everyday", "vulcanised"],
    shortDescription: "The high-top that has not gone out of style since 1917.",
    description:
      "A cotton canvas high-top on a vulcanised rubber sole, unchanged in spirit since 1917 and endlessly reissued. Reinforced toe cap, chrome eyelets, and a padded collar that takes the sting out of the ankle. Wears in about a week, then fits like it was made for you. The one to buy if you want a pair that works with absolutely everything.",
    images: ["/images/products/converse-chuck-1.jpg"],
    sizes: ADULT_SIZES.map((size) => ({ size, stock: 14 })),
  },
  {
    name: "Nike Air Force 1 '07",
    slug: "nike-air-force-1-07",
    sku: "NK-AF1-0007",
    brand: "nike",
    category: "sneakers",
    gender: "UNISEX",
    price: R(14500),
    discountPrice: R(12900),
    colorName: "White / White",
    colorHex: "#ffffff",
    material: "Leather upper, Nike Air cushioning, rubber outsole",
    featured: true,
    tags: ["air-force-1", "leather", "everyday", "cushioned"],
    shortDescription: "The 1982 basketball icon, still the easiest white shoe to wear.",
    description:
      "Born in 1982 as a basketball shoe and now the default white sneaker, with Nike Air cushioning in the heel and a perforated toe box that actually breathes. Full-grain leather upper that resists scuffs, a stacked midsole, and the pivot-circle outsole underneath. Comfortable enough for a full day, plain enough for anything.",
    images: ["/images/products/nike-af1-1.jpg"],
    sizes: ADULT_SIZES.map((size) => ({ size, stock: 8 + (Number(size) % 7) })),
  },
  {
    name: "New Balance 550",
    slug: "new-balance-550",
    sku: "NBL-0550-0001",
    brand: "new-balance",
    category: "sneakers",
    gender: "UNISEX",
    price: R(11000),
    discountPrice: null,
    colorName: "White / Cream",
    colorHex: "#f2efe6",
    material: "Leather and suede upper, foam midsole",
    featured: true,
    tags: ["550", "lifestyle", "suede", "court"],
    shortDescription: "A properly good-looking court shoe, revived from the nineties.",
    description:
      "Originally a basketball court shoe, the 550 went away and came back as a lifestyle favourite because it looks good without trying too hard. Leather and suede panels across the upper, a low-cut padded collar, and a foam midsole that stays comfortable rather than just looking it. A quiet alternative to the obvious white trainer.",
    images: ["/images/products/new-balance-550-1.jpg"],
    sizes: ADULT_SIZES.map((size) => ({ size, stock: 9 })),
  },
  {
    name: "Vans Old Skool",
    slug: "vans-old-skool",
    sku: "VNS-OSK-0001",
    brand: "vans",
    category: "sneakers",
    gender: "UNISEX",
    price: R(5500),
    discountPrice: R(4800),
    colorName: "True White / Black",
    colorHex: "#f5f5f5",
    material: "Canvas and leather upper, vulcanised rubber sole",
    featured: false,
    tags: ["skate", "canvas", "skateboarding", "low-top"],
    shortDescription: "The skate shoe with the stripe down the side.",
    description:
      "Low-top canvas with a leather overlay around the toe, sitting on a vulcanised rubber sole with the waffle grip pattern skateboarding needs. The side stripe is the whole design, and it has been the same shape since 1975. Padded collar and heel, and light enough to wear all day without thinking about it.",
    images: ["/images/products/vans-old-skool-1.jpg"],
    sizes: ADULT_SIZES.map((size) => ({ size, stock: 16 })),
  },
  {
    name: "Puma Suede Classic",
    slug: "puma-suede-classic",
    sku: "PUM-SUE-0001",
    brand: "puma",
    category: "sneakers",
    gender: "UNISEX",
    price: R(9500),
    discountPrice: null,
    colorName: "White / Red",
    colorHex: "#f2f0ec",
    material: "Suede upper, rubber outsole, textile lining",
    featured: false,
    tags: ["suede", "retro", "court", "lightweight"],
    shortDescription: "A soft suede trainer with a genuinely light feel.",
    description:
      "A suede court trainer that has been in and out of fashion for decades. Soft suede upper with the Formstrip down each side, a padded collar and tongue, and a slim rubber outsole that keeps the whole thing light. Wears well with everything, and the kind of shoe people keep re-buying in a different colour.",
    images: ["/images/products/puma-suede-1.jpg"],
    sizes: ADULT_SIZES.map((size) => ({ size, stock: 11 })),
  },
];


// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding Bikalpa Shoes…\n");

  const categoryBySlug = new Map();
  for (const [index, c] of CATEGORIES.entries()) {
    const saved = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, kind: c.kind, sortOrder: c.sortOrder, isActive: true },
      create: { ...c, sortOrder: index + 1 },
    });
    categoryBySlug.set(c.slug, saved);
  }
  console.log(`  categories: ${CATEGORIES.length}`);

  const brandBySlug = new Map();
  for (const b of BRANDS) {
    const saved = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: { name: b.name, isActive: true },
      create: b,
    });
    brandBySlug.set(b.slug, saved);
  }
  console.log(`  brands:     ${BRANDS.length}`);

  let productCount = 0;
  for (const p of PRODUCTS) {
    const brand = brandBySlug.get(p.brand);
    const category = categoryBySlug.get(p.category);
    if (!brand || !category) throw new Error(`Unresolved relation for ${p.slug}`);

    const totalStock = p.sizes.reduce((sum, s) => sum + s.stock, 0);
    // Must mirror `effectivePrice` so listings sort and range-filter correctly.
    const sortPrice = p.discountPrice ?? p.price;

    const saved = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        sku: p.sku,
        description: p.description,
        shortDescription: p.shortDescription ?? null,
        price: p.price,
        discountPrice: p.discountPrice ?? null,
        compareAtPrice: p.discountPrice ? p.price : null,
        sortPrice,
        images: p.images,
        gender: p.gender,
        colorName: p.colorName ?? null,
        colorHex: p.colorHex ?? null,
        material: p.material ?? null,
        tags: p.tags ?? [],
        status: "ACTIVE",
        featured: p.featured ?? false,
        totalStock,
        brandId: brand.id,
        categoryId: category.id,
      },
      create: {
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        description: p.description,
        shortDescription: p.shortDescription ?? null,
        price: p.price,
        discountPrice: p.discountPrice ?? null,
        compareAtPrice: p.discountPrice ? p.price : null,
        sortPrice,
        images: p.images,
        gender: p.gender,
        colorName: p.colorName ?? null,
        colorHex: p.colorHex ?? null,
        material: p.material ?? null,
        tags: p.tags ?? [],
        status: "ACTIVE",
        featured: p.featured ?? false,
        totalStock,
        brandId: brand.id,
        categoryId: category.id,
      },
    });

    for (const s of p.sizes) {
      await prisma.productSize.upsert({
        where: { productId_size: { productId: saved.id, size: s.size } },
        update: { stock: s.stock, isActive: true },
        create: { productId: saved.id, size: s.size, stock: s.stock, isActive: true },
      });
    }

    productCount++;
  }
  console.log(`  products:   ${productCount}`);

  // --- Reconcile the catalogue ---------------------------------------------
  // Upserting alone would leave the previous catalogue in place, so anything no
  // longer listed is removed. Products are deleted outright; brands and
  // categories are only deactivated so their ids stay stable and can be
  // reactivated by re-adding them to the arrays above.
  //
  // Deleting a product cannot damage sales history: `OrderItem.productId` is
  // `onDelete: SetNull` and each line item keeps its own productName, price and
  // image snapshot. Size and image rows cascade.
  const liveSlugs = PRODUCTS.map((p) => p.slug);
  const removedProducts = await prisma.product.deleteMany({
    where: { slug: { notIn: liveSlugs } },
  });

  const deadBrands = await prisma.brand.updateMany({
    where: { slug: { notIn: BRANDS.map((b) => b.slug) }, isActive: true },
    data: { isActive: false },
  });

  const deadCategories = await prisma.category.updateMany({
    where: { slug: { notIn: CATEGORIES.map((c) => c.slug) }, isActive: true },
    data: { isActive: false },
  });

  if (removedProducts.count > 0 || deadBrands.count > 0 || deadCategories.count > 0) {
    console.log(
      `  reconciled: removed ${removedProducts.count} product(s), ` +
        `deactivated ${deadBrands.count} brand(s) and ${deadCategories.count} category(ies)`
    );
  }

  // --- Administrator ------------------------------------------------------
  // The password hash is produced by better-auth's own hasher so the format
  // matches what sign-in expects.
  //
  // The credential Account row must use `accountId = user.id`, NOT the email.
  // better-auth looks the account up by the user's id, so an accountId of
  // "admin@bikalpa.com" is never found and every sign-in attempt fails with
  // INVALID_EMAIL_OR_PASSWORD even though the stored hash is correct.
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@bikalpa.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? generateSecurePassword();
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn(
      "\n  WARNING: SEED_ADMIN_PASSWORD is not set. A random password has been generated."
    );
    console.warn("  Store it somewhere safe — it cannot be recovered later.\n");
  }
  const passwordHash = await hashPassword(adminPassword);

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existing) {
    // Both the password and the accountId are re-synced on every run, so
    // changing SEED_ADMIN_PASSWORD in .env actually takes effect instead of
    // silently leaving a stale hash behind.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN", isActive: true, emailVerified: true, passwordHash },
      }),
      prisma.account.upsert({
        where: { providerId_accountId: { providerId: "credential", accountId: existing.id } },
        create: {
          userId: existing.id,
          accountId: existing.id,
          providerId: "credential",
          password: passwordHash,
        },
        update: { password: passwordHash },
      }),
    ]);
    // Drop any legacy row keyed by the email so only one credential account exists.
    await prisma.account.deleteMany({
      where: { userId: existing.id, providerId: "credential", accountId: { not: existing.id } },
    });
    console.log(`  admin:      ${adminEmail} (existing, promoted to ADMIN, password re-synced)`);
  } else {
    const created = await prisma.user.create({
      data: {
        name: "Bikalpa Admin",
        email: adminEmail,
        emailVerified: true,
        passwordHash,
        role: "ADMIN",
        isActive: true,
      },
    });
    await prisma.account.create({
      data: {
        userId: created.id,
        accountId: created.id,
        providerId: "credential",
        password: passwordHash,
      },
    });
    console.log(`  admin:      ${adminEmail} (created, password: ${adminPassword})`);
  }

  console.log("\nImage credits (Wikimedia Commons):");
  for (const [url, credit] of Object.entries(IMAGE_CREDITS)) {
    console.log(`  ${url}\n    \"${credit.file}\" - ${credit.license}`);
  }

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("\nSeed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });