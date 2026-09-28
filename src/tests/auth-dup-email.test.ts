import { describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authApiResponse, AuthApiError } from "@/server/auth-cookies";

/**
 * `asResponse: true` is required to obtain the session cookie, but it changes
 * how failures are reported: better-auth returns an error *response* instead of
 * throwing, so the actions need `authApiResponse` to turn a rejected sign-up
 * back into a throw. Without that wrapper a duplicate registration would be
 * reported to the user as a success.
 */
describe("authApiResponse", () => {
  it("re-throws a duplicate sign-up as an AuthApiError carrying better-auth's code", async () => {
    const email = `dup-${Date.now()}@example.com`;
    try {
      await auth.api.signUpEmail({
        body: { name: "First", email, password: "Str0ng!Passw0rd" },
        asResponse: true,
      });

      const attempt = authApiResponse(() =>
        auth.api.signUpEmail({
          body: { name: "Second", email, password: "Str0ng!Passw0rd" },
          asResponse: true,
        })
      );

      await expect(attempt).rejects.toBeInstanceOf(AuthApiError);
      await expect(attempt).rejects.toMatchObject({
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
        status: 422,
      });
    } finally {
      await prisma.user.deleteMany({ where: { email } });
      await prisma.$disconnect();
    }
  });

  it("re-throws a wrong password as an AuthApiError", async () => {
    const email = `wrongpw-${Date.now()}@example.com`;
    try {
      await auth.api.signUpEmail({
        body: { name: "Real", email, password: "Str0ng!Passw0rd" },
        asResponse: true,
      });

      const attempt = authApiResponse(() =>
        auth.api.signInEmail({
          body: { email, password: "Wr0ng!Passw0rd" },
          asResponse: true,
        })
      );

      await expect(attempt).rejects.toBeInstanceOf(AuthApiError);
      await expect(attempt).rejects.toMatchObject({ status: 401 });
    } finally {
      await prisma.user.deleteMany({ where: { email } });
      await prisma.$disconnect();
    }
  });

  it("passes a successful response straight through", async () => {
    const email = `ok-${Date.now()}@example.com`;
    try {
      const response = await authApiResponse(() =>
        auth.api.signUpEmail({
          body: { name: "Fine", email, password: "Str0ng!Passw0rd" },
          asResponse: true,
        })
      );
      expect(response.ok).toBe(true);
      expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
      await prisma.$disconnect();
    }
  });
});
