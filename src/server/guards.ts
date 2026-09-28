import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth, roleOf, type AuthUser } from "@/lib/auth";
import type { UserRole } from "@/lib/constants";

/**
 * Authorization helpers.
 *
 * Every protected page, route handler and server action must resolve identity
 * through one of these functions. There is deliberately no "isLoggedIn" boolean
 * and no role check that can be skipped, so a missing guard fails to compile
 * rather than silently exposing data.
 *
 * `cache()` dedupes session lookups within a single request, so calling
 * `getCurrentUser()` from a page and its components hits the database once.
 */

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

export const getCurrentUserRole = cache(async (): Promise<UserRole | null> => {
  const user = await getCurrentUser();
  return user ? roleOf(user) : null;
});

/** Requires a signed-in user. Redirects to login otherwise. */
export async function requireUser(returnTo?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = returnTo ? `?callbackUrl=${encodeURIComponent(returnTo)}` : "";
    redirect(`/login${target}`);
  }
  return user;
}

/**
 * Requires an ADMIN.
 *
 * A non-admin gets a 404 rather than a 403, so the existence of an admin area is
 * not disclosed to a customer who guesses the URL.
 */
export async function requireAdmin(returnTo?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = returnTo ? `?callbackUrl=${encodeURIComponent(returnTo)}` : "";
    redirect(`/login${target}`);
  }
  if (user.isActive === false) redirect("/login");
  if (roleOf(user) !== "ADMIN") notFound();
  return user;
}

/** Server-action variant: throws instead of redirecting, since redirects are not usable in actions. */
export async function assertUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in to do that.");
  return user;
}

export async function assertAdmin(): Promise<AuthUser> {
  const user = await assertUser();
  if (roleOf(user) !== "ADMIN") {
    throw new Error("Administrator access required.");
  }
  if (user.isActive === false) throw new Error("This account has been deactivated.");
  return user;
}

export class ForbiddenError extends Error {
  override name = "ForbiddenError";
  constructor(message = "You do not have access to this resource.") {
    super(message);
  }
}

export class UnauthorizedError extends Error {
  override name = "UnauthorizedError";
  constructor(message = "You must be signed in to do that.") {
    super(message);
  }
}
