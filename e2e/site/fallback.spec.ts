// T10: with no WebGL the hero still shows the device, as the 2D WebDuo or the recorded loop with its poster (PLAN 5).
// Red until step 6.
import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2"] } });

test("hero without WebGL", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "the WebGL switch is a Chromium flag");
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForTimeout(2000);
  const hero = page.getByTestId("hero");
  const web = hero.locator(".web-duo, [data-testid='web-duo']");
  const loop = hero.locator("video[poster]");
  expect((await web.count()) + (await loop.count()), "WebDuo or the loop").toBeGreaterThan(0);
  if (await loop.count()) expect(await loop.first().getAttribute("poster")).toMatch(/\.webp$/);
  expect(errors).toEqual([]);
});
