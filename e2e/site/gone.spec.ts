// T11: retired routes are gone; the routes the Duo e2e harness and tools use stay, but no public page links to them
// (PLAN 8, adjusted: lab, mockup, workbench, scroll, probe, column, panes, book and api/* are test infrastructure).
// Red until step 8.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { GONE, HARNESS, PAGES } from "./site";

const APP = join(__dirname, "../../apps/site/app");

for (const path of GONE) {
  test(`${path} is gone`, async ({ request }) => {
    expect((await request.get(path)).status()).toBe(404);
  });
}

test("harness routes stay in the source", () => {
  for (const r of HARNESS) expect(existsSync(join(APP, r, "page.tsx")), `${r}/page.tsx`).toBe(true);
});

for (const path of PAGES) {
  test(`${path} links no harness or retired route`, async ({ page }) => {
    await page.goto(path);
    const hrefs = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => new URL((a as HTMLAnchorElement).href).pathname));
    const bad = hrefs.filter((h) => [...HARNESS, ...GONE].some((r) => h === r || h.startsWith(`${r}/`)));
    expect(bad).toEqual([]);
  });
}
