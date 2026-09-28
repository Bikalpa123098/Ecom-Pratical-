"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

/**
 * Browser-side auth client.
 *
 * `role` is inferred so the UI can show admin links, but the server ignores any
 * client-supplied role on sign-up (see `src/lib/auth.ts`), so this is for
 * presentation only, never for authorisation.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
