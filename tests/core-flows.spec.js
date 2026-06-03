import { test, expect } from "@playwright/test";

// Core authenticated flows. Run with test credentials:
//   SITE1_TEST_EMAIL=... SITE1_TEST_PASSWORD=... npm test
// Against live:  add SITE1_URL=https://site1-zeta-one.vercel.app
const email = process.env.SITE1_TEST_EMAIL;
const password = process.env.SITE1_TEST_PASSWORD;

test.describe("core flows", () => {
  test.skip(!email || !password, "set SITE1_TEST_EMAIL / SITE1_TEST_PASSWORD to run");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("••••••••").fill(password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByText(/company dashboard|projects|on site|today/i).first())
      .toBeVisible({ timeout: 20000 });
  });

  test("builder: dashboard and projects list", async ({ page }) => {
    await expect(page.getByText(/company dashboard/i)).toBeVisible();
    await page.getByRole("button", { name: /projects/i }).first().click();
    await expect(page.getByRole("button", { name: /new project/i })).toBeVisible();
  });

  test("supervisor: project dashboard shows the tile grid", async ({ page }) => {
    await page.goto("/?dev=true&role=supervisor");
    await expect(page.getByTestId("tile-tasks")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("tile-attendance")).toBeVisible();
    await expect(page.getByTestId("tile-overview")).toBeVisible();
  });

  test("supervisor: can create a task", async ({ page }) => {
    await page.goto("/?dev=true&role=supervisor");
    await page.getByTestId("tile-tasks").click();
    await page.getByText(/project tasks/i).click();
    await page.getByRole("button", { name: /\+ add/i }).click();
    const title = `PW test task ${Date.now()}`;
    await page.getByPlaceholder(/task title/i).fill(title);
    await page.getByRole("button", { name: /create task/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });
  });

  test("supervisor: attendance muster opens", async ({ page }) => {
    await page.goto("/?dev=true&role=supervisor");
    await page.getByTestId("tile-attendance").click();
    await expect(page.getByText(/today/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/workers|total on site|nobody on site/i).first()).toBeVisible();
  });

  test("supervisor: photos gallery opens", async ({ page }) => {
    await page.goto("/?dev=true&role=supervisor");
    await page.getByTestId("tile-photos").click();
    await expect(page.getByText(/take|add|no photos/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("supervisor: overview loads", async ({ page }) => {
    await page.goto("/?dev=true&role=supervisor");
    await page.getByTestId("tile-overview").click();
    await expect(page.getByText(/needs attention|on site/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("worker: dashboard shows the on-site indicator", async ({ page }) => {
    await page.goto("/?dev=true&role=worker");
    await expect(page.getByText(/off site|on site|other site/i).first()).toBeVisible({ timeout: 20000 });
  });

  test("client: progress view loads", async ({ page }) => {
    await page.goto("/?dev=true&role=client");
    await expect(page.getByText(/% complete|current stage|no project linked/i).first()).toBeVisible({ timeout: 20000 });
  });
});
