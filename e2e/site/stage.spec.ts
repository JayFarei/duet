// T3: one live stage per page, so one WebGL context, and it stops rendering off screen (PLAN 5). Red until step 5.
import { expect, test } from "@playwright/test";
import { COUNT_WEBGL, EXAMPLES, scrollThrough } from "./site";

for (const path of ["/", ...EXAMPLES]) {
  test(`one WebGL context on ${path}`, async ({ page }) => {
    await page.addInitScript(COUNT_WEBGL);
    await page.goto(path);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __webgl: number }).__webgl), { message: "the stage made its context" }).toBe(1);
    await scrollThrough(page);
    expect(await page.evaluate(() => (window as unknown as { __webgl: number }).__webgl), "still one after a full scroll").toBe(1);
  });
}

test("the stage stops rendering past the tour", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __duoFrames?: number }).__duoFrames ?? -1), { message: "the stage counts frames" }).toBeGreaterThan(0);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(600);
  const a = await page.evaluate(() => (window as unknown as { __duoFrames: number }).__duoFrames);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as unknown as { __duoFrames: number }).__duoFrames), "no frames off screen").toBe(a);
});
