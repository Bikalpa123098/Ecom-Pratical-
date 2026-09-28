import { describe, expect, it } from "vitest";
import { safeRedirect } from "@/lib/redirects";

describe("safeRedirect", () => {
  it("keeps a same-site path", () => {
    expect(safeRedirect("/account/orders", "/account")).toBe("/account/orders");
    expect(safeRedirect("/shop?page=2", "/account")).toBe("/shop?page=2");
  });

  it("falls back when there is nothing to redirect to", () => {
    expect(safeRedirect(undefined, "/account")).toBe("/account");
    expect(safeRedirect(null, "/account")).toBe("/account");
    expect(safeRedirect("", "/account")).toBe("/account");
  });

  it("refuses an absolute URL to another host", () => {
    expect(safeRedirect("https://evil.example/steal", "/account")).toBe("/account");
    expect(safeRedirect("http://evil.example", "/account")).toBe("/account");
  });

  it("refuses a protocol-relative URL that only looks local", () => {
    // Starts with "/", so a naive startsWith check would wave these through.
    expect(safeRedirect("//evil.example", "/account")).toBe("/account");
    expect(safeRedirect("/\\evil.example", "/account")).toBe("/account");
  });

  it("refuses a backslash that a browser may normalise into a host", () => {
    expect(safeRedirect("/\\evil.example", "/account")).toBe("/account");
    expect(safeRedirect("/account\\..\\evil", "/account")).toBe("/account\\..\\evil");
  });

  it("refuses a redirect that would loop back through sign-in", () => {
    expect(safeRedirect("/login", "/account")).toBe("/account");
    expect(safeRedirect("/login?callbackUrl=/x", "/account")).toBe("/account");
    expect(safeRedirect("/register", "/account")).toBe("/account");
  });
});
