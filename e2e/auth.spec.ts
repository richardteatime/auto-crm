import { test, expect } from "@playwright/test";
import { loginAsTestUser, logout, TEST_USER } from "./fixtures/auth";

test.describe("Autenticazione", () => {
  test("utente non autenticato viene reindirizzato al login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*login.*/);
    await expect(page.getByRole("heading", { name: /CRM Pro/i })).toBeVisible();
  });

  test("login con utente di test apre la dashboard", async ({ page }) => {
    await loginAsTestUser(page);

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("main").getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });

  test("il logout funziona", async ({ page }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL("/");

    await page.locator("header").getByRole("button", { name: "Esci" }).click();
    await expect(page).toHaveURL(/.*login.*/);
  });
});
