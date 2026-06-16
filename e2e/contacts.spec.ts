import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/auth";
import { cleanupTestContacts } from "./fixtures/db";

test.describe("Contatti", () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestContacts();
    await loginAsTestUser(page);
  });

  test("il pulsante 'Aggiungi contatto' nello stato vuoto apre il form", async ({ page }) => {
    await page.goto("/contacts");

    await expect(page.getByRole("button", { name: "Aggiungi contatto" })).toBeVisible();

    await page.getByRole("button", { name: "Aggiungi contatto" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Nuovo Contatto" })
    ).toBeVisible();
  });

  test("il pulsante 'Nuovo Contatto' in alto apre il form", async ({ page }) => {
    await page.goto("/contacts");
    await expect(page.getByRole("button", { name: "Nuovo Contatto" })).toBeVisible();

    await page.getByRole("button", { name: "Nuovo Contatto" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("creazione e eliminazione di un contatto", async ({ page }) => {
    await page.goto("/contacts");
    await expect(page.getByRole("button", { name: "Nuovo Contatto" })).toBeVisible();

    await page.getByRole("button", { name: "Nuovo Contatto" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const unique = Date.now().toString();
    await page.getByLabel("Nome").fill(`Test E2E ${unique}`);
    await page.getByLabel("Email").fill(`test${unique}@example.com`);
    await page.getByRole("button", { name: "Crea" }).click();

    await expect(page.getByText(`Test E2E ${unique}`)).toBeVisible();

    // Cleanup: open the contact and delete it
    await page.getByText(`Test E2E ${unique}`).click();
    await expect(page).toHaveURL(/\/contacts\//);
    await page.getByRole("button", { name: "Elimina" }).click();
    await page.goto("/contacts");
    await expect(page.getByText(`Test E2E ${unique}`)).not.toBeVisible();
  });
});
