import { expect, test } from "@playwright/test";

// The home page is three parts: the hero with the live Duo, how it works, then docs and examples.
test("the home page has three sections, in order", async ({ page }) => {
  await page.goto("/");
  const ids = await page.locator("main > section[id]").evaluateAll((s) => s.map((e) => e.id));
  expect(ids).toEqual(["top", "rules", "docs"]);
});

// After the demo, each thing is said once: where the controls go, the controls, then the code and what else ships.
// The controls already play the book and sheet pages, so there is no separate examples block repeating them.
test("after the demo, each part appears once", async ({ page }) => {
  await page.goto("/");
  expect(await page.locator("main .h3").allTextContents()).toEqual(["Where the controls go", "The controls", "Also included"]);
  await expect(page.locator("#docs .example")).toHaveCount(0);
});

test("the docs list what else is included, in plain names", async ({ page }) => {
  await page.goto("/");
  const names = await page.locator("#docs .lib-item h3").allTextContents();
  expect(names).toEqual(["Panes", "useDuet", "Colors", "Server rendering"]);
  for (const href of await page.locator("#docs .lib-item").evaluateAll((a) => a.map((e) => e.getAttribute("href")))) expect(href).toBeTruthy();
});

// "The controls": each part of duet-ui, credited by name with a picture of it on the real 3D Duo, playable on the stage.
test("each control shows on the 3D Duo and plays on the stage", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator("#rules .control");
  await expect(cards).toHaveCount(6);
  expect(await cards.locator(".tile-h").allTextContents()).toEqual(["Tabs", "“…”", "Menu", "Buttons", "Main button", "Close"]);
  for (const [i, still] of ["form-tabs", "form-more", "control-menu", "form-menu", "control-main", "control-close"].entries()) {
    const img = cards.nth(i).locator(".rule-shot img");
    await expect(img).toHaveAttribute("src", `/media/${still}.webp`);
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth)).toBeGreaterThan(0);
    expect(await cards.nth(i).locator("a.rule-link").getAttribute("href")).toBeTruthy();
  }
  const played = await page.evaluate(() => {
    const seen: string[] = [];
    addEventListener("duet:moment", (e) => seen.push((e as CustomEvent<string>).detail));
    addEventListener("duet:example", (e) => seen.push((e as CustomEvent<{ src: string }>).detail.src));
    document.querySelectorAll<HTMLButtonElement>("#rules .control .rule-show").forEach((b) => b.click());
    return seen;
  });
  expect(played).toEqual(["fit", "folded", "burger", "burger", "/book", "/sheet"]);
});
