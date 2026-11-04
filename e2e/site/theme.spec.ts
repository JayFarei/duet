// T7: the theme toggle swaps the page, the stage's appearance and every loop to its dark recording (PLAN 3, 5).
// Red until step 7.
import { expect, test } from "@playwright/test";

test.use({ colorScheme: "light" });

test("dark theme reaches the videos and the stage", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /dark|theme/i }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const srcs = await page.evaluate(() => [...document.querySelectorAll("video")].map((v) => v.currentSrc || v.querySelector("source")?.getAttribute("src") || v.getAttribute("src") || ""));
  expect(srcs.length).toBeGreaterThan(0);
  for (const s of srcs) expect(s).toMatch(/-dark\.mp4$/);
  const frame = page.frames().find((f) => f.url().includes("/duo3d/screen"));
  expect(frame, "the stage's screen").toBeTruthy();
  await expect.poll(() => frame!.evaluate(() => document.documentElement.getAttribute("data-lg-theme") || document.documentElement.dataset.theme)).toBe("dark");
});
