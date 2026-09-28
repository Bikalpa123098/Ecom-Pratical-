import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { UserRole } from "@/lib/constants";

/**
 * better-auth configuration.
 *
 * MongoDB is reached through Prisma, so the Prisma adapter is used with
 * `provider: "mongodb"`.
 *
 * `role` is an additional field on the User model; it is never accepted from a
 * sign-up payload (`input: false`), only ever written by an admin promotion, so
 * a customer cannot self-assign ADMIN by tampering with the request body.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "mongodb" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  user: {
    additionalFields: {
      // Never accepted from a sign-up payload: a customer must not be able to
      // hand-craft a request that makes itself an administrator.
      role: { type: "string", defaultValue: "CUSTOMER", input: false },
      isActive: { type: "boolean", defaultValue: true, input: false },
      // The customer's own number, so it is writable at sign-up. It carries no
      // privilege and is still validated by `nepalPhoneSchema` server-side.
      phone: { type: "string", required: false, input: true },
    },
  },
  advanced: {
    database: { generateId: false },
  },
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;

export function roleOf(user: { role?: unknown } | null | undefined): UserRole {
  return user?.role === "ADMIN" ? "ADMIN" : "CUSTOMER";
}
