import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/auth";
import { cleanupTestDeals } from "./fixtures/db";

test.describe("Trattative", () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestDeals();
    await loginAsTestUser(page);
  });

  test("il pulsante 'Crea trattativa' nello stato vuoto apre il form", async ({ page }) => {
    await page.goto("/deals");

    await expect(page.getByRole("button", { name: "Crea trattativa" })).toBeVisible();

    await page.getByRole("button", { name: "Crea trattativa" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Nuova Trattativa" })
    ).toBeVisible();
  });

  test("il pulsante 'Nuova Trattativa' in alto apre il form", async ({ page }) => {
    await page.goto("/deals");
    await expect(page.getByRole("button", { name: "Nuova Trattativa" })).toBeVisible();

    await page.getByRole("button", { name: "Nuova Trattativa" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
