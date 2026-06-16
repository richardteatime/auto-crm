import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/auth";

test.describe("Navigazione mobile", () => {
  test("cliccando una voce di menu il sheet si chiude", async ({ page }) => {
    await loginAsTestUser(page);

    await page.setViewportSize({ width: 375, height: 667 });

    // Open mobile menu
    await page.getByRole("button", { name: "Apri menu navigazione" }).click();

    // Wait for the mobile sheet to be open by checking a link inside it
    const mobileContactsLink = page
      .locator('[data-slot="sheet-content"]')
      .getByRole("link", { name: "Contatti" });
    await expect(mobileContactsLink).toBeVisible();

    // Click a menu item
    await mobileContactsLink.click();
    await expect(page).toHaveURL("/contacts");

    // Sheet should be closed: the mobile-specific link is no longer visible
    await expect(mobileContactsLink).not.toBeVisible();
  });
});
