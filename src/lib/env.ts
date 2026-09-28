import "server-only";

import { z } from "zod";

/**
 * Server-side environment. Nothing in this module may be imported from a client
 * component — it holds the eSewa signing secret and the database URL.
 *
 * The `server-only` import makes that a build error rather than a runtime
 * surprise. Next.js only exposes `NEXT_PUBLIC_*` to the browser, so a client
 * import would throw on the missing variables, and if the names were ever
 * renamed to be public it would quietly inline the secrets into the bundle.
 * Client components that need the delivery figures receive them as props from a
 * server component instead.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Public base URL of this deployment. eSewa success_url/failure_url are
  // derived from it on the server and are never taken from client input.
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 chars"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),

  // --- eSewa ePay ---------------------------------------------------------
  // "test" uses the rc/uat gateway and the EPAYTEST merchant code.
  // "production" uses the live gateway. Switch with this one variable.
  ESEWA_MODE: z.enum(["test", "production"]).default("test"),
  ESEWA_MERCHANT_CODE: z.string().default("EPAYTEST"),
  // HMAC-SHA256 signing key issued by eSewa. NEVER expose to the browser.
  ESEWA_SECRET_KEY: z.string().default(""),
  // Demo mode simulates the eSewa gateway locally (for student projects).
  ESEWA_DEMO_MODE: z.enum(["true", "false"]).default("false"),
  // Optional overrides; when empty the module derives the documented defaults
  // for the active ESEWA_MODE.
  ESEWA_FORM_URL: z.string().url().optional(),
  ESEWA_STATUS_URL: z.string().url().optional(),

  // --- Store ---------------------------------------------------------------
  // Delivery charges are configured in RUPEES and converted to paisa by
  // `calculateTotals`, because "80" almost always means Rs. 80 to whoever edits
  // this file. Everything downstream is paisa.
  DELIVERY_CHARGE_INSIDE_VALLEY_RUPEES: z.coerce.number().int().nonnegative().default(80),
  DELIVERY_CHARGE_OUTSIDE_VALLEY_RUPEES: z.coerce.number().int().nonnegative().default(150),
  // In PAISA, because it is compared directly against a paisa subtotal.
  FREE_DELIVERY_THRESHOLD_PAISA: z.coerce.number().int().nonnegative().default(500_000),
  // Basis points of the subtotal.
  TAX_RATE_BPS: z.coerce.number().int().nonnegative().default(0),

  // Public store contact details, used by the contact page, the footer and the
  // policy pages. Validation is deliberately loose: a mistyped phone number
  // should not stop the site from building.
  STORE_PHONE: z.string().default("+977 980-0000000"),
  STORE_WHATSAPP: z.string().default("+9779800000000"),
  STORE_EMAIL: z.string().default("hello@bikalpashoes.com"),
  STORE_ADDRESS: z.string().default("New Road, Kathmandu, Nepal"),
  STORE_HOURS: z.string().default("Sunday–Friday, 10:00–18:00"),

  SEED_ADMIN_EMAIL: z.string().default("admin@bikalpa.com"),
  // When SEED_ADMIN_PASSWORD is unset we generate a random one at seed time
  // rather than falling back to a known default. The generated password is
  // printed once by the seed script and cannot be recovered later.
  SEED_ADMIN_PASSWORD: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
