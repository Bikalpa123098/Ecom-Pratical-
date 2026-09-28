/**
 * Redirect-target validation.
 *
 * Lives outside the `"use server"` modules because both the server actions and
 * the server components need it, and a `"use server"` file may only export async
 * functions. It is a pure function with no server-only imports, so it is safe
 * for either side of the boundary.
 */

/**
 * Restricts a post-authentication destination to a path on this site.
 *
 * Anything else falls back to `fallback`. Without this, `/login?callbackUrl=
 * https://evil.example` turns sign-in into an open redirect that phishs a
 * freshly authenticated visitor, and a protocol-relative `//evil.example` does
 * the same while looking like a local path.
 */
export function safeRedirect(target: string | null | undefined, fallback: string): string {
  if (!target) return fallback;
  if (!target.startsWith("/")) return fallback;
  // `//host` and `/\host` are protocol-relative URLs, not local paths.
  if (target.startsWith("//") || target.startsWith("/\\")) return fallback;
  // Back in to the sign-in pages would bounce the visitor straight back here.
  if (target.startsWith("/login") || target.startsWith("/register")) return fallback;
  return target;
}
