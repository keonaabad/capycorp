import { expect, test } from "@playwright/test";

// Override the project's authenticated storage state for this file only —
// this test exists specifically to check the unauthenticated path.
test.use({ storageState: { cookies: [], origins: [] } });

test("redirects an unauthenticated visitor to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
