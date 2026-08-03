import { expect, test } from "@playwright/test";

test("creates a business and its agent state persists across reload", async ({
  page,
}) => {
  const businessName = `E2E Co ${Date.now()}`;

  await page.goto("/business");
  await page.getByLabel("Name").fill(businessName);
  await page.getByRole("button", { name: "Create business" }).click();

  await expect(page).toHaveURL(/\/business\/.+/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    businessName,
  );
  await expect(page.locator("canvas")).toBeVisible();

  // The manager sprite starts at its idle position, (70, 50) in canvas
  // coordinates (lib/simulation/office-layout.ts) — click it to select it
  // in the inspector, the same way a real user would.
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas did not render a bounding box");
  await page.mouse.click(box.x + 70, box.y + 50);

  const inspector = page.getByTestId("agent-inspector");
  await expect(inspector).toContainText("Moss");
  await expect(page.getByTestId("inspector-state")).toContainText("idle");

  // There's no manual dev-control UI on the real business page anymore
  // (state changes come from real orchestration) — drive the transition
  // through the same API route orchestration itself uses, the way a real
  // task run would, rather than a removed UI control.
  const agentId = await inspector.getAttribute("data-agent-id");
  if (!agentId) throw new Error("inspector did not expose an agent id");
  const patchResponse = await page.request.patch(`/api/agents/${agentId}`, {
    data: { action: "setState", to: "assigned" },
  });
  expect(patchResponse.ok()).toBe(true);

  // Re-fetch the canvas after reload rather than reusing `box` — Pixi's
  // setup() is async, so the canvas needs a moment to be re-appended and
  // ready for hit-testing before a click at a stale bounding box would
  // land on anything.
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  const boxAfterReload = await page.locator("canvas").boundingBox();
  if (!boxAfterReload) throw new Error("canvas did not render a bounding box");
  await expect(async () => {
    await page.mouse.click(boxAfterReload.x + 70, boxAfterReload.y + 50);
    await expect(page.getByTestId("inspector-state")).toContainText(
      "assigned",
    );
  }).toPass({ timeout: 5000 });

  // The activity feed reads AgentEvent rows back from the same reload —
  // proves the Server Component actually renders fresh event history,
  // not just fresh agent state.
  await expect(page.getByTestId("activity-feed")).toContainText(
    "idle → assigned",
  );
});
