// T9: no sideways scroll, 16px gutters at 390, the sticky stage clear of caption text, a full-page screenshot of every
// page at each size (PLAN 3). Red until the pages exist (steps 4 to 7).
import { expect, test } from "@playwright/test";
import { GPU, PAGES, scrollThrough } from "./site";

// The pages carry the live stage: drawn in software it starves the main thread past the timeout.
test.use(GPU);

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
