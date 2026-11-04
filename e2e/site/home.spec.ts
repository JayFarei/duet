// The home page is one short page: the live simulator, how Duet works, the examples, install. The simulator is the
// interactive 3D Duo with prod's controls (turns, fold, Device, Surface, Layout, System UI, With or Without Duet) on the skeleton site.
import { expect, test } from "@playwright/test";
import { GPU, stageReady } from "./site";

test.use(GPU);

const onScreen = (page: import("@playwright/test").Page, path: string) =>
  expect.poll(() => page.frames().some((f) => f.url().includes(path)), { message: `the simulator runs ${path}`, timeout: 20_000 }).toBe(true);

test("four sections, in order, and no tour", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main > section[id]")).toHaveCount(4);
  expect(await page.locator("main > section[id]").evaluateAll((s) => s.map((e) => e.id))).toEqual(["simulator", "how", "examples", "install"]);
  await expect(page.locator("#tour")).toHaveCount(0);
  await expect(page.locator("main video")).toHaveCount(0);
});

test("the simulator is the live Duo with its controls, and no presets", async ({ page }) => {
  await page.goto("/");
  const sim = page.getByTestId("simulator");
  await stageReady(page);
  await expect(sim.getByRole("radio", { name: "With Duet" })).toBeVisible();
  for (const name of ["Closed", "Open", "Tent", "Laptop"]) await expect(sim.getByRole("button", { name, exact: true }).first()).toBeVisible();
  await expect(sim.getByText("System UI", { exact: true }).first()).toBeVisible();
  await expect(sim.getByRole("group", { name: "Moments" })).toHaveCount(0);
  await expect(sim.getByRole("button", { name: "Sidebar", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("app-picker")).toHaveCount(0);
  await onScreen(page, "/skeleton");
  expect((await page.request.get("/skeleton")).status()).toBe(200);
});

test("the controls under the device hold still as the posture changes", async ({ page }) => {
  await page.goto("/");
  await stageReady(page);
  const sim = page.getByTestId("simulator");
  const top = () => sim.getByRole("radio", { name: "With Duet" }).evaluate((e) => Math.round(e.getBoundingClientRect().top + scrollY));
  const before = await top();
  for (const name of ["Closed", "Tent", "Laptop", "Open"]) {
    await sim.getByRole("button", { name, exact: true }).first().click();
    await page.waitForTimeout(600);
    expect(await top(), name).toBe(before);
  }
});

test("an example shows its source", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("#examples article", { hasText: "Inbox" });
  await card.getByText(/code/i).first().click();
  await expect(card.locator("pre")).toContainText("<Duet");
});
