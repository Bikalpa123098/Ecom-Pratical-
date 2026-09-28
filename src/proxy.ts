import { NextResponse, type NextRequest } from "next/server";

/**
 * Mints the anonymous guest-cart cookie.
 *
 * This has to run on every request because the cart is read by the root layout
 * on every page, and Next.js forbids `cookies().set()` while a Server Component
 * renders. Minting here means every read path can stay read-only, and the cookie
 * is attached to the response before the page is streamed.
 */

const GUEST_CART_COOKIE = "bkl_guest_cart";
const GUEST_TOKEN_RE = /^[a-f0-9]{48}$/;

/** 24 random bytes, hex encoded (48 chars). */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function proxy(request: NextRequest) {
  const existing = request.cookies.get(GUEST_CART_COOKIE)?.value;
  if (existing && GUEST_TOKEN_RE.test(existing)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set(GUEST_CART_COOKIE, newToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return response;
}

export const config = {
  // Static assets and image optimisation never need a cart token.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|txt|xml|json)$).*)",
  ],
};
