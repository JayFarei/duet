import { expect, test } from "@playwright/test";

// The home page is three parts: the hero with the live Duo, how it works, then docs and examples.
test("the home page has three sections, in order", async ({ page }) => {
  await page.goto("/");
  const ids = await page.locator("main > section[id]").evaluateAll((s) => s.map((e) => e.id));
  expect(ids).toEqual(["top", "rules", "docs"]);
});

// "How big they are": each form is a picture of the real 3D Duo, and its button plays that moment on the stage.
test("each form card shows the 3D Duo and plays its moment", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator(".rule");
  await expect(cards).toHaveCount(3);
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
      document.querySelectorAll<HTMLButtonElement>(".rule-show").forEach((b) => b.click());
      setTimeout(() => done(seen), 50);
    });
  });
  expect(moments).toEqual(["fit", "folded", "burger"]);
});
