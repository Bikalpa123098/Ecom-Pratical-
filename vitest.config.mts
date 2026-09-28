import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    setupFiles: ["./src/tests/setup.ts"],
    // Integration tests talk to a real MongoDB, so they are slower than the
    // unit suites. A hung connection must fail rather than stall the run.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Two files sharing one Prisma client concurrently is fine, but keeping
    // files serial makes database-state assertions predictable.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      // `server-only` intentionally throws when imported outside a React Server
      // Component graph. Unit tests exercise this module as plain Node, so map
      // it to a no-op rather than weakening the guard in source.
      "server-only": fileURLToPath(new URL("./src/tests/stubs/server-only.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
