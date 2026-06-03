import { defineConfig, devices } from "@playwright/test";

// Run against a local dev server by default. Set SITE1_URL to test the live
// deployment instead (e.g. SITE1_URL=https://site1-zeta-one.vercel.app npm test).
const BASE = process.env.SITE1_URL || "http://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // Only auto-start the dev server when testing locally
  webServer: process.env.SITE1_URL ? undefined : {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
