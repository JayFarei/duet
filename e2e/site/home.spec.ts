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

test("each example has a looping demo of what its controls do", async ({ page }) => {
  await page.goto("/");
  const demos = page.locator("#examples .exd");
  await expect(demos).toHaveCount(3);
  expect(await demos.evaluateAll((d) => d.map((e) => e.getAttribute("data-demo")))).toEqual(["inbox", "checkout", "reader"]);
  expect(await demos.first().evaluate((e) => e.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
});

test("off a Duo the top bar keeps its links and Duet draws nothing", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".nav-links")).toBeVisible();
  await expect(page.locator("[data-duet-control]")).toHaveCount(0);
});

test.describe("on a Duo", () => {
  test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1", screen: { width: 466, height: 678 }, viewport: { width: 466, height: 678 } });

  test("the sections are Duet's places and the top bar keeps the name only", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-duet-control]").first()).toBeVisible();
    await expect(page.locator(".nav-links")).toBeHidden();
    await expect(page.locator(".nav-brand")).toBeVisible();
  });
});
