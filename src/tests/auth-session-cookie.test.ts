import { afterAll, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseSetCookie } from "@/server/auth-cookies";

/**
 * Signing in has to hand the session cookie to the browser.
 *
 * Calling `auth.api.signInEmail(...)` on its own returns the session *data* and
 * throws the `Set-Cookie` header away — the cookie is only written when the
 * call is made with `asResponse: true` and the header is copied into Next's
 * cookie store. Without that the user is created, the row exists, and the very
 * next `getSession({ headers })` still finds no cookie, so the app looks like it
 * refused the sign-in.
 */

const created: string[] = [];

async function makeUser() {
  const email = `signin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await auth.api.signUpEmail({
    body: { name: "Sign In Test", email, password: "Str0ng!Passw0rd" },
  });
  created.push(email);
  return email;
}

/** Session cookie pairs from a better-auth Response, as a Cookie header. */
function cookieHeaderFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((raw) => raw.split(";")[0])
    .join("; ");
}

afterAll(async () => {
  if (created.length) {
    await prisma.user.deleteMany({ where: { email: { in: created } } });
  }
  await prisma.$disconnect();
});

describe("sign-in sets a session cookie", () => {
  it("returns a Set-Cookie header when called with asResponse", async () => {
    const email = await makeUser();

    const response = await auth.api.signInEmail({
      body: { email, password: "Str0ng!Passw0rd" },
      asResponse: true,
    });

    const setCookies = response.headers.getSetCookie();
    expect(setCookies.length).toBeGreaterThan(0);

    const sessionCookie = setCookies.find((c) => c.includes("better-auth.session_token"));
    expect(sessionCookie, "no session_token cookie was issued").toBeTruthy();
  });

  it("resolves a session when the forwarded cookie is presented", async () => {
    const email = await makeUser();

    const response = await auth.api.signInEmail({
      body: { email, password: "Str0ng!Passw0rd" },
      asResponse: true,
    });

    // This is what the action has to do: hand the cookie back to the browser.
    const cookie = cookieHeaderFrom(response);
    expect(cookie).toContain("better-auth.session_token");

    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session).toBeTruthy();
    expect(session?.user.email).toBe(email);
  });

  it("has no session when no cookie is presented", async () => {
    const email = await makeUser();
    // Sign-in happened, but the cookie was discarded, so the app sees a stranger.
    await auth.api.signInEmail({ body: { email, password: "Str0ng!Passw0rd" } });

    const session = await auth.api.getSession({ headers: new Headers() });
    expect(session).toBeNull();
  });
});

describe("parseSetCookie", () => {
  it("reads the name, value and flags off a real session cookie", () => {
    const parsed = parseSetCookie(
      "better-auth.session_token=abc.DEF_ghi; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600"
    );
    expect(parsed.name).toBe("better-auth.session_token");
    expect(parsed.value).toBe("abc.DEF_ghi");
    expect(parsed.attributes).toMatchObject({
      path: "/",
      httponly: "",
      samesite: "Lax",
      "max-age": "3600",
    });
  });

  it("keeps a value that contains its own equals sign intact", () => {
    const parsed = parseSetCookie("t=a=b=c; Path=/");
    expect(parsed.name).toBe("t");
    expect(parsed.value).toBe("a=b=c");
  });

  it("treats a valueless flag as present", () => {
    const parsed = parseSetCookie("t=v; HttpOnly; Secure");
    expect(parsed.attributes).toHaveProperty("httponly");
    expect(parsed.attributes).toHaveProperty("secure");
  });

  it("defaults an absent Path so the cookie is not scoped to nothing", () => {
    const parsed = parseSetCookie("t=v; HttpOnly");
    // toCookieOptions falls back to "/" when Path is missing.
    expect(parsed.attributes.path).toBeUndefined();
  });
});
