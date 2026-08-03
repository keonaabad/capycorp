import { expect, test } from "@playwright/test";

// Override the project's authenticated storage state for this file only —
// this test exists specifically to check the unauthenticated path.
test.use({ storageState: { cookies: [], origins: [] } });

test("shows the public landing page at the root, not a redirect", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: "Build your own AI company and watch it work." }),
  ).toBeVisible();
});

test("redirects an unauthenticated visitor away from the business app", async ({
  page,
}) => {
  await page.goto("/business");
  await expect(page).toHaveURL("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
