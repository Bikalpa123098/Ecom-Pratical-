import "server-only";

import { cookies } from "next/headers";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

/**
 * Forwards the session cookies better-auth issued to the browser.
 *
 * `auth.api.signInEmail()` called directly on the server returns the session
 * *data* and throws the `Set-Cookie` header away. The cookie is only produced
 * when the call is made with `asResponse: true`, and even then nothing writes it
 * to the response on its own: it has to be copied into Next's cookie store.
 * Skipping this step is why a correct password still lands on the sign-in page
 * again — the account exists, but the browser holds no session.
 *
 * `cookies().set()` is only permitted in a Server Action or Route Handler,
 * which is where these sign-in/sign-up actions run.
 */

/** Parses one `Set-Cookie` value into the shape `cookies().set()` expects. */
export function parseSetCookie(raw: string): {
  name: string;
  value: string;
  attributes: Record<string, string>;
} {
  const [pair = "", ...rest] = raw.split(";");
  const separator = pair.indexOf("=");
  const attributes: Record<string, string> = {};

  for (const part of rest) {
    const eq = part.indexOf("=");
    const key = (eq === -1 ? part : part.slice(0, eq)).trim().toLowerCase();
    if (key) attributes[key] = eq === -1 ? "" : part.slice(eq + 1).trim();
  }

  return {
    // Split on the first `=` only: a base64url token has no padding, but a value
    // containing `=` must survive intact. A malformed header with no `=` yields an
    // empty value, and the caller drops it because the name is blank.
    name: pair.slice(0, Math.max(0, separator)).trim(),
    value: separator === -1 ? "" : pair.slice(separator + 1).trim(),
    attributes,
  };
}

/**
 * Reverses the percent-encoding a cookie value already carries.
 *
 * `cookies().set()` percent-encodes the value it is given. better-auth has
 * *already* encoded the session token, so passing its value through untouched
 * encodes it twice: a token ending `=` arrives as `%3D` and is stored as
 * `%253D`. The browser then sends back a token better-auth cannot decode, the
 * session lookup misses, and a correct password still lands on the sign-in page
 * again. Decoding first makes the round trip byte-for-byte identical to the one
 * better-auth's own route handler produces.
 *
 * `decodeURIComponent` throws on a malformed sequence, and a value that is not
 * valid encoding must be passed through untouched rather than lose its
 * characters. A literal `+` is left alone, because it is not a space here: this
 * is a cookie value, not form data.
 */
function decodeCookieValue(value: string): string {
  if (!value.includes("%")) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toCookieOptions(attributes: Record<string, string>): Partial<ResponseCookie> {
  const options: Partial<ResponseCookie> = { path: attributes.path ?? "/" };

  if (attributes["max-age"]) {
    const maxAge = Number(attributes["max-age"]);
    if (Number.isFinite(maxAge)) options.maxAge = maxAge;
  }
  if (attributes.expires) {
    const expires = new Date(attributes.expires);
    if (!Number.isNaN(expires.getTime())) options.expires = expires;
  }
  if ("httponly" in attributes) options.httpOnly = true;
  if ("secure" in attributes) options.secure = true;

  const sameSite = attributes.samesite?.toLowerCase();
  if (sameSite === "lax") options.sameSite = "lax";
  else if (sameSite === "strict") options.sameSite = "strict";
  else if (sameSite === "none") options.sameSite = "none";

  return options;
}

/** Copies every `Set-Cookie` from a better-auth response into the response. */
export async function applyAuthCookies(response: Response): Promise<void> {
  const setCookies = response.headers.getSetCookie();
  if (setCookies.length === 0) return;

  const jar = await cookies();
  for (const raw of setCookies) {
    const { name, value, attributes } = parseSetCookie(raw);
    if (!name) continue;
    jar.set(name, decodeCookieValue(value), toCookieOptions(attributes));
  }
}

/**
 * An auth failure surfaced from a better-auth response body.
 *
 * Carries better-auth's own `code` so the action can map it to a message
 * without having to match on prose.
 */
export class AuthApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Runs a better-auth call that was made with `asResponse: true` and re-throws a
 * failure as a normal exception.
 *
 * This is not optional. With `asResponse`, better-auth reports errors as an
 * error *response* — a duplicate sign-up comes back as `422` with
 * `{ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" }` rather than throwing — so
 * without this check a rejected sign-up looks like a successful one.
 */
export async function authApiResponse(run: () => Promise<Response>): Promise<Response> {
  const response = await run();

  if (response.ok) return response;

  let message = `Request failed with status ${response.status}.`;
  let code = "";
  try {
    const body = (await response.clone().json()) as { message?: string; code?: string };
    if (body?.message) message = body.message;
    if (body?.code) code = body.code;
  } catch {
    // A non-JSON error body; the status-derived message is good enough.
  }

  throw new AuthApiError(message, code, response.status);
}
