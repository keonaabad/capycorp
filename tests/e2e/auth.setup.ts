import { expect, test as setup } from "@playwright/test";
import { STORAGE_STATE } from "../../playwright.config";

const TEST_EMAIL = "e2e@example.com";
const TEST_PASSWORD = "e2e-test-password";

setup("authenticate", async ({ page, request }) => {
  // Registration is idempotent from the suite's perspective: a 409 just
  // means a previous run already created this account, which is fine —
  // sign-in below is what actually matters.
  await request.post("/api/auth/register", {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD, name: "E2E Test" },
  });

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  await page.context().storageState({ path: STORAGE_STATE });
});
