// T1: the light glass rim reads as a bright edge in every engine, not black caps (PLAN 1a, docs/edge-cases.md
// "Light rim paints black off iOS"). iOS WebKit keeps its colour dodge under @supports (-webkit-touch-callout: none);
// checked on the Duo Lab sim, since no desktop engine matches that query. Dark is unchanged; its 1px rim on black
// peaks 14 to 20 levels over the page, so the dark floor is 12.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { capLuminance } from "./site";

const CSS = readFileSync(join(__dirname, "../../packages/duet-ui/src/duet.css"), "utf8");

/** Duet's glass markup on a list page, without React: the library's CSS alone decides the rim. */
async function staticGroup(page: Page, dark: boolean) {
  const bg = dark ? "#000" : "rgb(242 242 247)", ink = dark ? "#fff" : "#000";
  const rows = Array.from({ length: 30 }, (_, i) => `<p style="margin:0;padding:12px 20px;border-bottom:1px solid ${dark ? "#333" : "#c6c6c8"}">Message ${i + 1}, a line of page text under the glass</p>`).join("");
  await page.setContent(`<!doctype html><html${dark ? ' data-lg-theme="dark"' : ' data-lg-theme="light"'}><head><style>${CSS}</style>
    <style>html,body{margin:0;background:${bg};color:${ink};font:16px -apple-system,system-ui,sans-serif}</style></head><body>${rows}
    <nav class="duet" data-mode="inline" data-side="right"><div class="duet-group" data-duet-slot="actions" style="left:${300}px;top:120px;width:49px;height:200px">
    <i class="duet-edge" aria-hidden></i><i class="duet-rim" aria-hidden></i>
    <button class="duet-btn" style="top:0;width:49px">A</button><button class="duet-btn" style="top:51.7px;width:49px">B</button></div></nav></body></html>`);
  await page.waitForTimeout(300);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} rim`, () => {
    test.use({ colorScheme: scheme });

    test("library glass on a list page", async ({ page }) => {
      await staticGroup(page, scheme === "dark");
      const { cap, peak, bg } = await capLuminance(page);
      if (scheme === "light") {
        expect(cap, `light cap luminance (black caps read 31 to 39)`).toBeGreaterThanOrEqual(180);
        expect(await page.locator(".duet-rim").evaluate((e) => getComputedStyle(e).mixBlendMode), "no colour dodge off iOS").toBe("normal");
      } else {
        expect(Math.abs(peak - bg), `dark cap peak ${peak} against page ${bg}`).toBeGreaterThanOrEqual(12);
      }
    });

    test("Inbox example", async ({ page }) => {
      await page.goto("/examples/inbox?plain");
      await page.locator("nav.duet .duet-group").first().waitFor();
      await page.waitForTimeout(800); // groups pop in on a spring
      const { cap, peak, bg } = await capLuminance(page);
      if (scheme === "light") expect(cap).toBeGreaterThanOrEqual(180);
      else expect(Math.abs(peak - bg)).toBeGreaterThanOrEqual(12);
    });
  });
}
