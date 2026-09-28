"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { assertUser, getCurrentUser } from "@/server/guards";
import { applyAuthCookies, authApiResponse, AuthApiError } from "@/server/auth-cookies";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
  type LoginInput,
  type RegisterInput,
} from "@/lib/schemas";
import { fieldErrorsFrom } from "@/server/validation";
import { safeRedirect } from "@/lib/redirects";
import { mergeGuestCartIntoUser, readGuestCartToken } from "@/server/services/cart";

/**
 * Authentication server actions.
 *
 * Credentials are verified by better-auth against its own password hashes; these
 * actions only translate Zod validation, surface a message safe to show a
 * stranger, and then reset the session cookie. The browser never receives a
 * token, a hash or a role.
 *
 * Sign-in is deliberately lockout-agnostic: better-auth applies its own rate
 * limiting, and the error returned here is intentionally identical for "no such
 * account" and "wrong password" so account existence cannot be enumerated.
 */

export interface AuthState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Set on success so the client form can navigate instead of following a redirect. */
  redirectTo?: string;
}

/* A "use server" module may only export async functions: Next.js builds one
 * server-action module per file, and a non-function export (a plain object, a
 * Zod schema) fails the whole module at load time with
 * "A \"use server\" file can only export async functions, found object."
 * That takes down every action in the file at once, not just the bad export.
 * So `AuthState` is exported as a type (erased at compile time), and shared
 * values such as the initial form state live with the components instead. */

/**
 * Only same-site relative paths are accepted as a post-login destination, so a
 * crafted `?callbackUrl=https://evil.example` cannot turn login into an open
 * redirect that phishs a freshly authenticated user. Shared with the sign-in and
 * registration pages, which must apply the identical rule.
 */

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted fields.",
      errors: fieldErrorsFrom(parsed.error),
    };
  }

  const input: LoginInput = parsed.data;
  const destination = safeRedirect(
    formData.get("redirectTo")?.toString(),
    "/account"
  );
  // Read once: `headers()` is async, and it is needed inside the callback below.
  const requestHeaders = await headers();

  try {
    // `asResponse` is required: without it the Set-Cookie header carrying the
    // session is discarded, and the next `getSession` sees no cookie at all, so
    // a correct password looks like a failed sign-in. `authApiResponse` turns
    // better-auth's error responses back into throws, so a wrong password is
    // still a rejected sign-in.
    //
    // The incoming headers must be forwarded. better-auth derives the client
    // address from `x-forwarded-for` to rate-limit per caller; called without
    // them it has no address to key on, so every server-action sign-in shares
    // one bucket and a legitimate customer gets locked out by other traffic.
    const response = await authApiResponse(() =>
      auth.api.signInEmail({
        body: { email: input.email, password: input.password },
        headers: requestHeaders,
        asResponse: true,
      })
    );
    await applyAuthCookies(response);

    // Merge any anonymous guest cart into the signed-in account.
    const guestToken = await readGuestCartToken();
    if (guestToken) {
      const sessionData = await auth.api.getSession({ headers: requestHeaders });
      if (sessionData?.user) {
        await mergeGuestCartIntoUser(guestToken, sessionData.user.id);
      }
    }
  } catch (error) {
    if (error instanceof AuthApiError) {
      // 429 is a throttle, not a wrong password. Saying "those details did not
      // match" sends the customer off to retype a password that was correct.
      if (error.status === 429) {
        console.error("[auth] sign-in rate limited", error.code);
        return {
          ok: false,
          message: "Too many sign-in attempts. Please wait a minute and try again.",
          errors: {},
        };
      }
      // One message for both credential failure modes: do not leak which
      // emails are registered.
      return {
        ok: false,
        message: "Those details did not match an account. Please try again.",
        errors: {},
      };
    }
    // An infrastructure fault (database, cookie write) must not be reported as
    // a bad password: doing so both misleads the customer and hides real
    // failures from the server log.
    console.error("[auth] sign-in failed unexpectedly", error);
    return {
      ok: false,
      message: "We could not sign you in right now. Please try again shortly.",
      errors: {},
    };
  }

  // The session cookie is already set, so the customer is authenticated. A
  // failure to invalidate the router cache must not turn a completed sign-in
  // into a 500, but it is worth a log line because cached chrome can lag.
  try {
    revalidatePath("/", "layout");
  } catch (error) {
    console.error("[auth] sign-in cache revalidation failed", error);
  }
  return { ok: true, redirectTo: destination };
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted fields.",
      errors: fieldErrorsFrom(parsed.error),
    };
  }

  const input: RegisterInput = parsed.data;
  const destination = safeRedirect(formData.get("redirectTo")?.toString(), "/account");
  const requestHeaders = await headers();

  try {
    // The new account is only useful if the response also carries the session
    // cookie, so this mirrors `loginAction`.
    const response = await authApiResponse(() =>
      auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
          // `role` is absent by design: better-auth ignores it (`input: false`),
          // so a hand-crafted request cannot create an administrator.
          phone: input.phone,
        },
        headers: requestHeaders,
        asResponse: true,
      })
    );
    await applyAuthCookies(response);

    // Merge any anonymous guest cart into the new account so items added
    // before registration are not lost.
    const guestToken = await readGuestCartToken();
    if (guestToken) {
      const sessionData = await auth.api.getSession({ headers: requestHeaders });
      if (sessionData?.user) {
        await mergeGuestCartIntoUser(guestToken, sessionData.user.id);
      }
    }
  } catch (err) {
    const message = describeAuthError(err);
    return { ok: false, message, errors: message ? {} : { email: "Could not create account." } };
  }

  try {
    revalidatePath("/", "layout");
  } catch (error) {
    console.error("[auth] sign-up cache revalidation failed", error);
  }
  return { ok: true, redirectTo: destination };
}

export async function logoutAction(formData: FormData): Promise<void> {
  const destination = safeRedirect(formData.get("redirectTo")?.toString(), "/");
  await auth.api.signOut({ headers: await headers() });
  revalidatePath("/", "layout");
  redirect(destination);
}

export async function updateProfileAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  // Throws (redirecting to sign-in) if there is no session, so the update below
  // can never be reached anonymously.
  await assertUser();

  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted fields.",
      errors: fieldErrorsFrom(parsed.error),
    };
  }

  const updated = await auth.api.updateUser({
    headers: await headers(),
    body: parsed.data,
  });

  if (!updated) {
    return { ok: false, message: "We could not save your details. Please try again." };
  }

  revalidatePath("/account");
  revalidatePath("/account/profile");
  return { ok: true, message: "Your details have been saved." };
}

export async function changePasswordAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  await assertUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted fields.",
      errors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
    });
  } catch {
    return {
      ok: false,
      message: "Your current password was not correct.",
      errors: { currentPassword: "Check your current password and try again." },
    };
  }

  revalidatePath("/account/profile");
  return { ok: true, message: "Your password has been changed. Other devices were signed out." };
}

/** Reads the current user for pages that need to render authenticated chrome. */
export async function currentUserName(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.name ?? null;
}

function describeAuthError(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";

  if (code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" || /already exists/i.test(messageOf(err))) {
    return "An account already exists with that email. Try signing in instead.";
  }
  if (code === "USER_NOT_FOUND" || /user not found/i.test(messageOf(err))) {
    return "An account already exists with that email. Try signing in instead.";
  }
  if (code === "PASSWORD_TOO_SHORT" || /password/i.test(messageOf(err))) {
    return "Please choose a stronger password.";
  }
  if (/prisma|mongodb|database|connect/i.test(messageOf(err))) {
    console.error("[auth] sign-up failed", err);
    return "We could not create your account right now. Please try again shortly.";
  }
  console.error("[auth] sign-up failed", err);
  return "We could not create your account right now. Please try again.";
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message?: unknown }).message ?? "");
  }
  return "";
}
