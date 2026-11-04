// T5: one word per thing (PLAN 2). The library part (headings, Sidebar label, data-duet-fit, data-duet-control) is
// green from the lib stage on the plain Inbox example; the site part goes green with /components and the home rewrite.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { BANNED, CLIPS, CONTROLS, FITS, NOUNS, PAGES } from "./site";

test.describe("site", () => {
  test("/components lists the glossary in order", async ({ page }) => {
    await page.goto("/components");
    await expect(page.getByTestId("components-nav").getByRole("link")).toHaveText([...NOUNS]);
    await expect(page.locator("main h2")).toHaveText([...NOUNS]);
    await expect(page.getByTestId("variant-navigation").getByRole("tab")).toHaveText(Object.values(FITS));
    await expect(page.getByTestId("variant-primary").getByRole("tab")).toHaveText(["Confirm", "Direct", "Folded"]);
  });

  test("media basenames are the clip list", () => {
    const dir = join(__dirname, "../../apps/site/public/media/clip");
    const names = new Set(readdirSync(dir).map((f) => f.replace(/-(light|dark)\.(mp4|webp|cues\.json)$/, "")));
    expect([...names].sort()).toEqual([...CLIPS].sort());
  });

  for (const path of PAGES) {
    test(`no retired words on ${path}`, async ({ page }) => {
      await page.goto(path);
      const text = await page.evaluate(() => document.body.innerText);
      expect(text.match(BANNED)?.[0], "retired word in page text").toBeUndefined();
      const labels = await page.evaluate(() => [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")!));
      expect(labels.filter((l) => BANNED.test(l) || l === "Menu"), "retired word in aria-label").toEqual([]);
      const heads = await page.evaluate(() => [...document.querySelectorAll("h1,h2,h3,h4,.tile-h,.duet-menu-head")].map((e) => e.textContent!.trim()));
      expect(heads.filter((h) => h === "Menu" || h === "Buttons" || h === "…" || h === "“…”"), "retired heading").toEqual([]);
    });
  }
});

// /book (kept for the Duo e2e harness) runs Duet with places behind the Sidebar button, actions, More and a primary,
// so the library part is green from the lib stage; the plain Inbox block joins at step 4.
for (const path of ["/book", "/examples/inbox?plain"]) {
  test.describe(`library on ${path}`, () => {
    // Duet stands down on a desktop viewport, so its controls exist only at phone width.
    test.beforeEach(({ page }) => test.skip((page.viewportSize()?.width ?? 0) > 500, "Duet runs at phone width only"));

    test("controls carry their glossary names", async ({ page }) => {
      await page.goto(path);
      const nav = page.locator("nav.duet:not(.duet-sidebar)").first();
      await nav.locator(".duet-group").first().waitFor();
      expect(Object.keys(FITS)).toContain(await nav.getAttribute("data-duet-fit"));
      const kinds = await nav.locator(".duet-btn").evaluateAll((es) => es.map((e) => e.getAttribute("data-duet-control")));
      expect(kinds.length).toBeGreaterThan(0);
      for (const k of kinds) expect(CONTROLS as readonly (string | null)[]).toContain(k);
      expect(await page.locator('[aria-label="Menu"]').count(), "no control named Menu").toBe(0);
    });

    test("More lists Places and Actions", async ({ page }) => {
      await page.goto(path);
      await page.locator('nav.duet [data-duet-control="more"]').first().click();
      const heads = page.locator("nav.duet .duet-menu-head");
      await expect(heads.first()).toBeVisible();
      for (const h of await heads.allTextContents()) expect(["Places", "Actions"]).toContain(h);
    });

    test("the sidebar is named Sidebar", async ({ page }) => {
      await page.goto(path);
      await page.locator("nav.duet:not(.duet-sidebar) .duet-group").first().waitFor();
      const side = page.locator("nav.duet-sidebar");
      if (!(await side.count())) return; // a fit with no Sidebar button
      await expect(side).toHaveAttribute("aria-label", "Sidebar");
      await expect(side.locator(".duet-side-head")).toHaveText("Sidebar");
      const btn = page.locator('nav.duet [data-duet-control="sidebar"]');
      if (await btn.count()) await expect(btn.first()).toHaveAttribute("aria-label", "Sidebar");
    });
  });
}
