// T9: no sideways scroll, 16px gutters at 390, the sticky stage clear of caption text, a full-page screenshot of every
// page at each size (PLAN 3). Red until the pages exist (steps 4 to 7).
import { expect, test } from "@playwright/test";
import { PAGES, scrollThrough } from "./site";

for (const path of PAGES) {
  test(`layout of ${path}`, async ({ page }, info) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await scrollThrough(page, 150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no sideways scroll").toBe(true);
    if ((page.viewportSize()?.width ?? 0) <= 390) {
      const gutters = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll("main p, main h1, main h2, main pre")) {
          const r = el.getBoundingClientRect();
          if (r.width && (r.left < 15.5 || innerWidth - r.right < 15.5)) out.push(`${el.tagName} ${Math.round(r.left)}..${Math.round(r.right)}`);
        }
        return out;
      });
      expect(gutters, "text keeps a 16px gutter").toEqual([]);
    }
    // CSS pixels: at 3x a long page passes the GPU's largest texture (16384 px) and Chromium cannot capture it.
    const shot = await page.screenshot({ fullPage: true, scale: "css" });
    await info.attach(`${path.replace(/\//g, "_") || "home"}-${info.project.name}.png`, { body: shot, contentType: "image/png" });
  });
}

test("the sticky stage does not cover the tour caption", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.getElementById("tour-navigation")!.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(800);
  const overlap = await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="tour-stage"] canvas, [data-testid="tour-stage"] .duo3d')?.getBoundingClientRect();
    const cap = document.querySelector('[data-testid="tour-caption"]')?.getBoundingClientRect();
    if (!stage || !cap) return "missing";
    return Math.max(0, Math.min(stage.bottom, cap.bottom) - Math.max(stage.top, cap.top)) * Math.max(0, Math.min(stage.right, cap.right) - Math.max(stage.left, cap.left));
  });
  expect(overlap).toBe(0);
});
