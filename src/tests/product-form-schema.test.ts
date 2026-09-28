import { describe, expect, it } from "vitest";
import { productFormSchema } from "@/lib/schemas";

/**
 * The product editor submits blank optional fields as "", not as an absent key.
 * These cover the "generate it for me" path, because a blank slug or SKU has to
 * survive validation for the action's fallback to be reachable at all.
 */
const base = {
  name: "Trail Runner",
  description: "A light trail shoe for long days on rough ground.",
  price: "5200",
  discountPrice: "",
  imagesText: "/images/products/trail-runner-1.svg",
  brandId: "clh0k0000000000000000001",
  categoryId: "clh0k0000000000000000002",
  gender: "UNISEX",
  colorName: "",
  colorHex: "",
  material: "",
  tagsText: "",
  status: "DRAFT",
  featured: false,
  sizes: [{ size: "40", stock: "5" }],
} as const;

describe("productFormSchema", () => {
  it("accepts a blank slug and SKU so they can be generated", () => {
    const parsed = productFormSchema.safeParse({ ...base, slug: "", sku: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.slug).toBe("");
      expect(parsed.data.sku).toBe("");
    }
  });

  it("omits slug and SKU entirely when the keys are absent", () => {
    const parsed = productFormSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.slug).toBeUndefined();
      expect(parsed.data.sku).toBeUndefined();
    }
  });

  it("converts rupee price input to paisa", () => {
    const parsed = productFormSchema.safeParse({ ...base, price: "5200.50" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.price).toBe(520_050);
  });

  it("treats a blank discount price as no discount", () => {
    const parsed = productFormSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.discountPrice).toBeNull();
  });

  it("splits image paths one per line", () => {
    const parsed = productFormSchema.safeParse({
      ...base,
      imagesText: "/images/products/a.svg\n/images/products/b.svg",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.imagesText).toEqual([
        "/images/products/a.svg",
        "/images/products/b.svg",
      ]);
    }
  });

  it("rejects a discount price that is not lower than the price", () => {
    const parsed = productFormSchema.safeParse({ ...base, price: "1000", discountPrice: "1000" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a malformed slug rather than silently accepting it", () => {
    const parsed = productFormSchema.safeParse({ ...base, slug: "Trail Runner!" });
    expect(parsed.success).toBe(false);
  });

  it("accepts absolute image URLs as well as site-relative paths", () => {
    const parsed = productFormSchema.safeParse({
      ...base,
      imagesText: "https://cdn.example.com/a.svg",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an image value that is neither a path nor a URL", () => {
    const parsed = productFormSchema.safeParse({ ...base, imagesText: "not-an-image" });
    expect(parsed.success).toBe(false);
  });

  it("rejects duplicate sizes", () => {
    const parsed = productFormSchema.safeParse({
      ...base,
      sizes: [
        { size: "40", stock: "5" },
        { size: "40", stock: "2" },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});
