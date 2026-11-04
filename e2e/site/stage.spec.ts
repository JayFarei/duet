// T3: one live stage per page, so one WebGL context, and it stops rendering off screen (PLAN 5). Red until step 5.
import { expect, test } from "@playwright/test";
import { COUNT_WEBGL, EXAMPLES, GPU, scrollPage, scrollThrough } from "./site";

test.use(GPU);

for (const path of ["/", ...EXAMPLES]) {
  test(`one WebGL context on ${path}`, async ({ page }) => {
    // Below 768 an example plays its recorded loop instead of the stage, so it makes no context at all.
    const want = path !== "/" && page.viewportSize()!.width < 768 ? 0 : 1;
    await page.addInitScript(COUNT_WEBGL);
    await page.goto(path);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __webgl: number }).__webgl), { message: "the stage made its context", timeout: 20_000 }).toBe(want);
    await scrollThrough(page);
    expect(await page.evaluate(() => (window as unknown as { __webgl: number }).__webgl), `still ${want} after a full scroll`).toBe(want);
  });
}

test("the stage stops rendering past the tour", async ({ page }) => {
  await page.goto("/");
  // The hero copy fills the first screen, so the stage starts below the fold and draws nothing until it scrolls in.
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => (window as unknown as { __duoFrames?: number }).__duoFrames ?? 0);
  await page.waitForTimeout(1000);
  // At most the one frame duo draws as its model arrives.
  expect(await page.evaluate(() => (window as unknown as { __duoFrames?: number }).__duoFrames ?? 0), "no frames below the fold").toBeLessThanOrEqual(before + 1);
  await page.getByTestId("tour-stage").scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __duoFrames?: number }).__duoFrames ?? -1), { message: "the stage counts frames", timeout: 20_000 }).toBeGreaterThan(0);
  await scrollPage(page, -1);
  await page.waitForTimeout(1200);
  const a = await page.evaluate(() => (window as unknown as { __duoFrames: number }).__duoFrames);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as unknown as { __duoFrames: number }).__duoFrames), "no frames off screen").toBe(a);
});
