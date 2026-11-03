import { expect, test } from "@playwright/test";

// The home page is three parts: the hero with the live Duo, how it works, then docs and examples.
test("the home page has three sections, in order", async ({ page }) => {
  await page.goto("/");
  const ids = await page.locator("main > section[id]").evaluateAll((s) => s.map((e) => e.id));
  expect(ids).toEqual(["top", "rules", "docs"]);
});

// The docs show the real examples on the 3D Duo, then what the library ships, in plain one-word names.
test("each example plays on the stage's Duo", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator("#docs .example");
  await expect(cards).toHaveCount(3);
  for (const [i, name] of ["panes", "sheet", "book"].entries()) {
    const img = cards.nth(i).locator("img");
    await expect(img).toHaveAttribute("src", `/media/example-${name}.webp`);
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth)).toBeGreaterThan(0);
  }
  const seen = await page.evaluate(() => {
    const out: string[] = [];
    addEventListener("duet:example", (e) => out.push((e as CustomEvent<{ src: string }>).detail.src));
    document.querySelectorAll<HTMLButtonElement>("#docs .example button").forEach((b) => b.click());
    return out;
  });
  expect(seen).toEqual(["/panes", "/sheet", "/book"]);
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
