// The home page is one short page: the live simulator, how Duet works, the examples, install. The simulator is the
// interactive 3D Duo with its full controls (moments, toggles, fold, With or Without Duet) running the examples.
import { expect, test } from "@playwright/test";
import { GPU, stageReady } from "./site";

test.use(GPU);

const onScreen = (page: import("@playwright/test").Page, name: string) =>
  expect.poll(() => page.frames().some((f) => f.url().includes(`/examples/${name}`)), { message: `the simulator runs ${name}`, timeout: 20_000 }).toBe(true);

test("four sections, in order, and no tour", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main > section[id]")).toHaveCount(4);
  expect(await page.locator("main > section[id]").evaluateAll((s) => s.map((e) => e.id))).toEqual(["simulator", "how", "examples", "install"]);
  await expect(page.locator("#tour")).toHaveCount(0);
  await expect(page.locator("main video")).toHaveCount(0);
});

test("the simulator is the live Duo with its controls", async ({ page }) => {
  await page.goto("/");
  const sim = page.getByTestId("simulator");
  await stageReady(page);
  await expect(sim.getByRole("radio", { name: "With Duet" })).toBeVisible();
  await expect(sim.getByRole("button", { name: "Sidebar", exact: true })).toBeVisible();
  await onScreen(page, "inbox");
});

test("the app picker switches the simulator's app", async ({ page }) => {
  await page.goto("/");
  await stageReady(page);
  const picker = page.getByTestId("app-picker");
  await expect(picker.getByRole("button")).toHaveText(["Inbox", "Checkout", "Reader"]);
  await picker.getByRole("button", { name: "Checkout" }).click();
  await expect(picker.getByRole("button", { name: "Checkout" })).toHaveAttribute("aria-pressed", "true");
  await onScreen(page, "checkout");
});

test("an example's Try it loads it in the simulator", async ({ page }) => {
  await page.goto("/");
  await stageReady(page);
  const card = page.locator("#examples article", { hasText: "Reader" });
  await card.getByRole("button", { name: /try it/i }).click();
  await expect.poll(() => page.getByTestId("simulator").evaluate((e) => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })).toBe(true);
  await onScreen(page, "reader");
});

test("an example shows its source", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("#examples article", { hasText: "Inbox" });
  await card.getByText(/code/i).first().click();
  await expect(card.locator("pre")).toContainText("<Duet");
});
