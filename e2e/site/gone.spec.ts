// T11: retired routes are gone; the routes the Duo e2e harness and tools use stay, but no public page links to them
// (PLAN 8, adjusted: lab, mockup, workbench, scroll, probe, column, panes, book, sheet and api/* are test infrastructure;
// tools/e2e/catalogue.py drives /sheet, /book, /scroll and /probe on the Duo sims). Only /skeleton is gone.
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

// The full web Duo used the retired skeleton app; it now loads the Inbox example, and nothing it loads 404s.
test("/duo loads no retired route", async ({ page }) => {
  const missing: string[] = [];
  page.on("response", (r) => { if (r.status() === 404 && !new URL(r.url()).pathname.startsWith("/_vercel/")) missing.push(new URL(r.url()).pathname); });
  const html = await (await page.request.get("/duo")).text();
  expect(html).toContain("/examples/inbox");
  expect(html).not.toContain("/skeleton");
  await page.goto("/duo");
  await page.waitForTimeout(5_000);
  expect(missing).toEqual([]);
});
