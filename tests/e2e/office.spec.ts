import { expect, test } from "@playwright/test";

test("loads the office and changes an agent state via the dev control panel", async ({
  page,
}) => {
  await page.goto("/demo");

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

test("scripted demo drives state through the adapter and disables manual controls", async ({
  page,
}) => {
  await page.goto("/demo");

  const toggle = page.getByTestId("demo-toggle");
  await expect(toggle).toHaveText("▶ Play scripted demo");

  const managerState = page.getByTestId("agent-state-manager");
  await expect(managerState).toHaveText("idle");

  await toggle.click();
  await expect(toggle).toHaveText("■ Stop scripted demo");

  const managerButtons = page
    .getByTestId("agent-controls-manager")
    .getByRole("button");
  await expect(managerButtons.first()).toBeDisabled();

  // Script: manager goes assigned (t=0) -> walking (t=700) -> planning (t=1500).
  await expect(managerState).toHaveText("assigned", { timeout: 2000 });
  await expect(managerState).toHaveText("planning", { timeout: 3000 });

  await toggle.click();
  await expect(toggle).toHaveText("▶ Play scripted demo");
  await expect(managerButtons.first()).toBeEnabled();
});

test("clicking a capybara opens the inspector", async ({ page }) => {
  await page.goto("/demo");

  await expect(page.getByTestId("agent-inspector")).toContainText(
    "Click a capybara",
  );

  // The manager sprite starts at its idle position, (70, 50) in canvas
  // coordinates, established in lib/simulation/office-layout.ts.
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas did not render a bounding box");
  await page.mouse.click(box.x + 70, box.y + 50);

  await expect(page.getByTestId("agent-inspector")).toContainText("Moss");
  await expect(page.getByTestId("inspector-state")).toContainText("idle");
});
