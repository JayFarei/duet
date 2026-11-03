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

test("the docs list every feature of duet-ui, in plain names", async ({ page }) => {
  await page.goto("/");
  const names = await page.locator("#docs .lib-item h3").allTextContents();
  expect(names).toEqual(["Tabs", "Menu", "Buttons", "Main button", "Panes", "Sheets", "useDuet", "Colors"]);
  await expect(page.locator("#docs .lib-code")).toHaveCount(0);
  for (const href of await page.locator("#docs .lib-item").evaluateAll((a) => a.map((e) => e.getAttribute("href")))) expect(href).toBeTruthy();
});

// "How big they are": each form is a picture of the real 3D Duo, and its button plays that moment on the stage.
test("each form card shows the 3D Duo and plays its moment", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator("#rules .rule");
  await expect(cards).toHaveCount(3);
  expect(await cards.locator(".tile-h").allTextContents()).toEqual(["Tabs", "Tabs and More", "Menu"]);
  for (const [i, form] of ["tabs", "more", "menu"].entries()) {
    const img = cards.nth(i).locator(".rule-shot img");
    await expect(img).toHaveAttribute("src", `/media/form-${form}.webp`);
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth)).toBeGreaterThan(0);
  }
  const moments = await page.evaluate(() => {
    const seen: string[] = [];
    addEventListener("duet:moment", (e) => seen.push((e as CustomEvent<string>).detail));
    return new Promise<string[]>((done) => {
      document.querySelectorAll<HTMLButtonElement>("#rules .rule-show").forEach((b) => b.click());
      setTimeout(() => done(seen), 50);
    });
  });
  expect(moments).toEqual(["fit", "folded", "burger"]);
});
