import { defineConfig } from "vitest/config";

// Live sandbox suite (isolation + RBAC) — hits a real Supabase project as seeded users.
// Kept separate from the unit config so `npm run test:unit` never needs secrets and the
// Playwright specs are not collected. Run via `npm run sandbox:test`.
export default defineConfig({
  test: {
    include: ["tests/sandbox/**/*.test.mjs"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false, // shared auth/DB state — run suites serially
  },
});
