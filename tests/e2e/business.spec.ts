import { expect, test } from "@playwright/test";

// Business agent ids are DB-generated cuids, not the fixed "manager" etc.
// ids the /demo page uses — locate the manager's control block by its role
// label instead of a hardcoded test id.
function managerControls(page: import("@playwright/test").Page) {
  return page
    .locator('[data-testid^="agent-controls-"]')
    .filter({ hasText: "manager" });
}

test("creates a business and its agent state persists across reload", async ({
  page,
}) => {
  const businessName = `E2E Co ${Date.now()}`;

  await page.goto("/");
  await page.getByLabel("Name").fill(businessName);
  await page.getByRole("button", { name: "Create business" }).click();

  await expect(page).toHaveURL(/\/business\/.+/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    businessName,
  );
  await expect(page.locator("canvas")).toBeVisible();

  const controls = managerControls(page);
  const state = controls.locator('[data-testid^="agent-state-"]');
  await expect(state).toHaveText("idle");

  await controls.getByRole("button", { name: "assigned" }).click();
  await expect(state).toHaveText("assigned");

  await page.reload();
  await expect(
    managerControls(page).locator('[data-testid^="agent-state-"]'),
  ).toHaveText("assigned");
});
