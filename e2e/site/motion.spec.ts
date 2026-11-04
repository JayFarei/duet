// T8: reduced motion: no autoplay, no idle motion, tour steps still land on their end states (PLAN 3). Red until step 6.
import { expect, test } from "@playwright/test";
import { duetState } from "./site";

test.use({ reducedMotion: "reduce" });

test("reduced motion stills the stage and the loops", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1500);
  const yaw = await page.evaluate(() => (window as unknown as { __duoYaw?: number }).__duoYaw);
  expect(yaw, "idle yaw").toBe(0);
  const playing = await page.evaluate(() => [...document.querySelectorAll("video")].filter((v) => !v.paused).length);
  expect(playing, "no loop autoplays").toBe(0);

  await page.evaluate(() => { const el = document.getElementById("tour-actions")!; el.scrollIntoView({ block: "center" }); });
  await page.waitForTimeout(800);
  await expect(page.getByTestId("tour-caption")).toHaveText("Actions + Sidebar");
  expect((await duetState(page)).map((s) => s.fit)).toContain("sidebar");
});
