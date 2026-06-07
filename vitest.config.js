import { defineConfig } from "vitest/config";

// Unit tests live under src/. The Playwright e2e specs live under tests/ and are
// run by Playwright (`npm test`), not vitest.
export default defineConfig({
  test: {
    include: ["src/**/*.test.js"],
    exclude: ["tests/**", "node_modules/**", "dist/**"],
  },
});
