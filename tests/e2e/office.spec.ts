import { expect, test } from "@playwright/test";

test("loads the office and changes an agent state via the dev control panel", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Build your own AI company",
  );

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  const managerState = page.getByTestId("agent-state-manager");
  await expect(managerState).toHaveText("idle");

  await page
    .getByTestId("agent-controls-manager")
    .getByRole("button", { name: "assigned" })
    .click();
  await expect(managerState).toHaveText("assigned");

  await page
    .getByTestId("agent-controls-manager")
    .getByRole("button", { name: "walking_to_workstation" })
    .click();
  await expect(managerState).toHaveText("walking_to_workstation");
});

test("clicking a capybara opens the inspector", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("agent-inspector")).toContainText(
    "Click a capybara",
  );

  // The manager sprite starts at its idle position, (90, 70) in canvas
  // coordinates, established in lib/simulation/office-layout.ts.
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas did not render a bounding box");
  await page.mouse.click(box.x + 90, box.y + 70);

  await expect(page.getByTestId("agent-inspector")).toContainText("Moss");
  await expect(page.getByTestId("inspector-state")).toContainText("idle");
});
