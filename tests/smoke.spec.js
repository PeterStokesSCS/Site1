import { test, expect } from "@playwright/test";

// Read-only smoke: the app boots and shows the SITE1 login screen.
test("app loads to the SITE1 login screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("SITE", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible({ timeout: 15000 });
});

test("forgot-password flow opens", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /forgot password/i }).click();
  await expect(page.getByText(/reset password/i)).toBeVisible();
});

// Authenticated smoke — runs only if test credentials are provided via env:
//   SITE1_TEST_EMAIL=... SITE1_TEST_PASSWORD=... npm test
const email = process.env.SITE1_TEST_EMAIL;
const password = process.env.SITE1_TEST_PASSWORD;

test.describe("authenticated", () => {
  test.skip(!email || !password, "set SITE1_TEST_EMAIL / SITE1_TEST_PASSWORD to run");

  test("can log in and land on a dashboard", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("••••••••").fill(password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    // Builder lands on "Company Dashboard"; any role shows the SITE1 wordmark in-app
    await expect(page.getByText(/company dashboard|projects|on site|today/i).first()).toBeVisible({ timeout: 20000 });
  });
});
