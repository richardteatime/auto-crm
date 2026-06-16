import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/auth";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test("la dashboard mostra KPI e grafici", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("main").getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();

    // KPI cards should be visible
    await expect(page.getByText(/totale contatti/i)).toBeVisible();
    await expect(page.getByText(/trattative attive/i)).toBeVisible();
    await expect(page.getByText(/valore nel pipeline/i)).toBeVisible();
  });
});
