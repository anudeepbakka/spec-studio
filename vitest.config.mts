import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "evals/**/*.test.ts"],
    // Each database test runs PGlite migrations in beforeEach. Under load (the dev server compiling) that can pass
    // the 10 s default, so the limits are raised. See DECISIONS.md, "Test timing under load".
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
