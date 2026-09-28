/**
 * Env must be populated before any module that reads it is imported, so this
 * runs ahead of the test files via vitest `setupFiles`.
 *
 * The integration suite runs against the same seeded development database the
 * app uses locally, because it asserts on real catalogue data (12 products,
 * 7 categories, 5 brands). Point `TEST_DATABASE_URL` at a different database if
 * you would rather not touch the dev one — it must be seeded and pushed first.
 *
 * `BILKALPA_REQUIRE_DB=1` turns "database unreachable" from a skip into a
 * failure, which is what CI should use so an integration test can never pass by
 * quietly not running.
 */
const base: Record<string, string> = {
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    "mongodb://127.0.0.1:27017/bikalpa_shoes_dev?replicaSet=rs0&directConnection=true",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-at-least-16-chars-long",
  BETTER_AUTH_URL: "http://localhost:3000",
  ESEWA_MODE: "test",
  ESEWA_MERCHANT_CODE: "EPAYTEST",
  ESEWA_SECRET_KEY: "bikalpa-unit-test-secret",
  // The app's own .env would otherwise leak in; keep the suite hermetic.
  NODE_ENV: "test",
};

for (const [key, value] of Object.entries(base)) {
  if (!process.env[key]) process.env[key] = value;
}

export const REQUIRE_DB = process.env.BILKALPA_REQUIRE_DB === "1";
