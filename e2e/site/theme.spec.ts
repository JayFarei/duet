// T7: the theme toggle swaps the page, the stage's appearance and every loop to its dark recording (PLAN 3, 5).
// Red until step 7.
import { expect, test } from "@playwright/test";
import { GPU, stageReady } from "./site";

test.use({ colorScheme: "light", ...GPU });

test("dark theme reaches the simulator", async ({ page }) => {
  await page.goto("/");
  await stageReady(page);
  await page.getByRole("button", { name: /dark|theme/i }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const frame = page.frames().find((f) => f.url().includes("/duo3d/screen"));
  expect(frame, "the stage's screen").toBeTruthy();
  await expect.poll(() => frame!.evaluate(() => document.documentElement.getAttribute("data-lg-theme") || document.documentElement.dataset.theme)).toBe("dark");
});
