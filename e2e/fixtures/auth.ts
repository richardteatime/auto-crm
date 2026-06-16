import { Page, expect } from "@playwright/test";

export const TEST_USER = {
  email: "e2e-test@example.com",
  password: "TestPassword123!",
  name: "E2E Test User",
};

/**
 * Authenticate the page via the test-only login endpoint.
 * This avoids the rate-limited Appwrite email/password session endpoint
 * and is only available when ALLOW_TEST_AUTH=true.
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  const response = await page.request.post("/api/auth/test-login", {
    data: TEST_USER,
  });

  expect(response.ok(), "test login should succeed").toBeTruthy();

  // Navigate to a protected page and verify the session is active.
  await page.goto("/");
  await expect(page).toHaveURL("/");
}

/**
 * Clear the session cookie by calling the logout endpoint.
 */
export async function logout(page: Page): Promise<void> {
  await page.request.post("/api/auth/logout");
}
