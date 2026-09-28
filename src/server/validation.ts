import "server-only";

import { z } from "zod";

/**
 * Converts a ZodError into a flat, client-safe field-error map.
 * Messages are authored for end users, so they are safe to surface.
 */
export type FieldErrors = Record<string, string>;

export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function parseWith<T extends z.ZodType>(
  schema: T,
  input: unknown
): { ok: true; data: z.infer<T> } | { ok: false; errors: FieldErrors } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, errors: fieldErrorsFrom(result.error) };
}

/** A domain error that is safe to show the customer. */
export class AppError extends Error {
  override name = "AppError";
  constructor(
    message: string,
    readonly fieldErrors: FieldErrors = {}
  ) {
    super(message);
  }
}

export class OutOfStockError extends AppError {
  override name = "OutOfStockError";
  constructor(message: string) {
    super(message);
  }
}
