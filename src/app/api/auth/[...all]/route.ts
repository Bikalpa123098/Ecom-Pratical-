import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

/**
 * better-auth catch-all handler.
 *
 * Mounts sign-up, sign-in, sign-out, session and the email/password flows.
 * better-auth applies its own CSRF, rate limiting and cookie policy; do not
 * re-implement any of that here.
 *
 * The MongoDB adapter runs through Prisma (see `src/lib/auth.ts`), so requests
 * are dynamic and must never be cached.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const { GET, POST } = toNextJsHandler(auth.handler);
