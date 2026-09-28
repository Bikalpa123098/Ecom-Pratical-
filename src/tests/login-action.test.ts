import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `loginAction` used to call better-auth without the incoming request headers.
 *
 * better-auth derives the caller's address from `x-forwarded-for` to rate-limit
 * per client. With no headers it has no address to key on, so every server-action
 * sign-in shared a single bucket: one customer's retries locked out everyone,
 * and the resulting `429` was reported as "those details did not match", which
 * looks exactly like a wrong password.
 */

const requestHeaders = new Headers({
  "x-forwarded-for": "203.0.113.7",
  "user-agent": "vitest",
});

const setCookie = vi.fn();
const revalidatePath = vi.fn();
const signInEmail = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({ set: setCookie }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  auth: { api: { signInEmail: (...args: unknown[]) => signInEmail(...args) } },
}));

const { loginAction } = await import("@/app/actions/auth-actions");

function form(email: string, password: string, redirectTo = ""): FormData {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  data.set("redirectTo", redirectTo);
  return data;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setCookie.mockReturnValue(undefined);
  revalidatePath.mockReturnValue(undefined);
});

describe("loginAction", () => {
  it("forwards the request headers so better-auth can rate-limit per client", async () => {
    signInEmail.mockResolvedValue(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
    );

    await loginAction({ ok: false }, form("admin@bikalpa.com", "Bikalpa@12345"));

    expect(signInEmail).toHaveBeenCalledTimes(1);
    const passed = signInEmail.mock.calls[0]?.[0] as { headers: Headers };
    expect(passed.headers).toBeDefined();
    expect(passed.headers.get("x-forwarded-for")).toBe("203.0.113.7");
  });

  it("applies the session cookie and reports the sanitised destination", async () => {
    const upstream = new Response("{}", {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": "better-auth.session_token=abc123; Path=/; HttpOnly; SameSite=Lax",
      },
    });
    signInEmail.mockResolvedValue(upstream);

    const state = await loginAction(
      { ok: false },
      form("admin@bikalpa.com", "Bikalpa@12345", "/admin/products")
    );

    expect(state.ok).toBe(true);
    expect(state.redirectTo).toBe("/admin/products");
    expect(setCookie).toHaveBeenCalledWith(
      "better-auth.session_token",
      "abc123",
      expect.objectContaining({ path: "/", httpOnly: true, sameSite: "lax" })
    );
  });

  it("refuses an off-site redirect target", async () => {
    signInEmail.mockResolvedValue(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
    );

    const state = await loginAction(
      { ok: false },
      form("admin@bikalpa.com", "Bikalpa@12345", "https://evil.example")
    );

    expect(state.redirectTo).toBe("/account");
  });

  it("reports a throttled attempt as a throttle, not a wrong password", async () => {
    signInEmail.mockResolvedValue(
      jsonResponse(429, { code: "TOO_MANY_REQUESTS", message: "Too many requests" })
    );

    const state = await loginAction({ ok: false }, form("admin@bikalpa.com", "Bikalpa@12345"));

    expect(state.ok).toBe(false);
    expect(state.message).toMatch(/too many sign-in attempts/i);
    expect(state.message).not.toMatch(/did not match/i);
  });

  it("gives one indistinguishable message for a rejected credential", async () => {
    signInEmail.mockResolvedValue(
      jsonResponse(401, { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" })
    );

    const state = await loginAction({ ok: false }, form("nobody@example.com", "wrong-password"));

    expect(state.ok).toBe(false);
    expect(state.message).toMatch(/did not match/i);
  });

  it("does not blame the password when the failure is infrastructural", async () => {
    signInEmail.mockRejectedValue(new Error("Connection closed."));

    const state = await loginAction({ ok: false }, form("admin@bikalpa.com", "Bikalpa@12345"));

    expect(state.ok).toBe(false);
    expect(state.message).not.toMatch(/did not match/i);
    expect(state.message).toMatch(/could not sign you in/i);
  });
});
