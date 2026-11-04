// T8: reduced motion: no autoplay, no idle motion, and the simulator still boots its screens.
import { expect, test } from "@playwright/test";
import { GPU, duetState } from "./site";

test.use({ reducedMotion: "reduce", ...GPU });

test("reduced motion stills the stage and the loops", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1500);
  const yaw = await page.evaluate(() => (window as unknown as { __duoYaw?: number }).__duoYaw);
  expect(yaw ?? 0, "idle yaw").toBe(0);
  const playing = await page.evaluate(() => [...document.querySelectorAll("video")].filter((v) => !v.paused).length);
  expect(playing, "no loop autoplays").toBe(0);

  await page.getByTestId("simulator").scrollIntoViewIfNeeded();
  await expect.poll(async () => (await duetState(page)).length, { timeout: 20_000 }).toBeGreaterThan(0);
});
