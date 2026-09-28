import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `applyAuthCookies` is the link that makes a successful sign-in actually stick:
 * it copies better-auth's Set-Cookie values into Next's cookie store, which is
 * the only place a Server Action can write a cookie. Next's cookie jar is mocked
 * here so the calls can be inspected.
 */
const set = vi.fn();
const getSetCookie = () => new Set<string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({ set }),
}));

const { applyAuthCookies, parseSetCookie } = await import("@/server/auth-cookies");

function responseWith(...cookies: string[]): Response {
  const headers = new Headers();
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { headers });
}

beforeEach(() => set.mockClear());

describe("applyAuthCookies", () => {
  it("copies the session cookies into the Next cookie store", async () => {
    await applyAuthCookies(
      responseWith(
        "better-auth.session_token=abc.DEF; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax",
        "better-auth.session_data=xyz; Max-Age=300; Path=/; HttpOnly; SameSite=Lax"
      )
    );

    expect(set).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenCalledWith("better-auth.session_token", "abc.DEF", {
      path: "/",
      maxAge: 2592000,
      httpOnly: true,
      sameSite: "lax",
    });
    expect(set).toHaveBeenCalledWith(
      "better-auth.session_data",
      "xyz",
      expect.objectContaining({ maxAge: 300, httpOnly: true })
    );
  });

  it("marks the cookie secure when the origin is https", async () => {
    await applyAuthCookies(
      responseWith("better-auth.session_token=abc; Path=/; HttpOnly; Secure; SameSite=None")
    );
    expect(set).toHaveBeenCalledWith(
      "better-auth.session_token",
      "abc",
      expect.objectContaining({ secure: true, sameSite: "none" })
    );
  });

  it("does nothing when better-auth issued no cookies", async () => {
    await applyAuthCookies(new Response(null));
    expect(set).not.toHaveBeenCalled();
  });

  it("skips a malformed header rather than writing a nameless cookie", async () => {
    await applyAuthCookies(responseWith("=orphan; Path=/"));
    expect(set).not.toHaveBeenCalled();
  });

  it("decodes the value so Next does not encode it a second time", async () => {
    // better-auth percent-encodes the session token. `cookies().set()` encodes
    // whatever it is given, so handing over the encoded value stores `%253D`
    // where better-auth expects `%3D`. The browser then sends back a token it
    // cannot decode, the session lookup misses, and a correct password still
    // returns the visitor to the sign-in page.
    await applyAuthCookies(
      responseWith("better-auth.session_token=tok%2B%2Fen%3D; Path=/; HttpOnly")
    );

    expect(set).toHaveBeenCalledWith(
      "better-auth.session_token",
      "tok+/en=",
      expect.objectContaining({ path: "/" })
    );
  });

  it("keeps a literal plus sign, which is not a space in a cookie value", async () => {
    await applyAuthCookies(responseWith("better-auth.session_data=a+b/c; Path=/"));
    expect(set).toHaveBeenCalledWith(
      "better-auth.session_data",
      "a+b/c",
      expect.anything()
    );
  });

  it("passes a malformed escape through instead of losing the value", async () => {
    // A lone "%" is not valid encoding. Decoding must not throw, and must not
    // silently drop characters either.
    await applyAuthCookies(responseWith("better-auth.session_token=100%-done; Path=/"));
    expect(set).toHaveBeenCalledWith(
      "better-auth.session_token",
      "100%-done",
      expect.anything()
    );
  });
});

describe("parseSetCookie edge cases", () => {
  it("does not throw on an empty string", () => {
    const parsed = parseSetCookie("");
    expect(parsed.name).toBe("");
    expect(parsed.value).toBe("");
  });

  it("treats a header with no equals sign as malformed so the caller drops it", () => {
    const parsed = parseSetCookie("lonely");
    // No name means applyAuthCookies skips it, rather than writing a nameless cookie.
    expect(parsed.name).toBe("");
    expect(parsed.value).toBe("");
  });
});

void getSetCookie;
