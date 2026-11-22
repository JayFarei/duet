import { expect, test, type Page } from "@playwright/test";

// The card inspector and the viewer group on the lab page (apps/site/app/lab/inspector): useInspector, DuetInspector,
// DuetControlColumn, DuetInspectButton, inspectable, DuetViewer. Desktop Safari is off a Duo, so the commands are in
// the inspector's own glass column and two panes fit from 1050px.
const WIDE = { width: 1440, height: 900 };

async function load(page: Page, size = WIDE) {
  await page.setViewportSize(size);
  await page.goto("/lab/inspector?plain");
  await page.locator("[data-card]").first().waitFor();
}
const pane = (page: Page) => page.locator("aside.duet-inspector");
const column = (page: Page) => pane(page).getByRole("toolbar", { name: "Card controls" });
const command = (page: Page, name: string) => column(page).getByRole("button", { name, exact: true });
/** "closed", "split" or "full", from <html> and the pane, which must agree. */
async function level(page: Page) {
  const at = await page.evaluate(() => {
    const a = document.querySelector("aside.duet-inspector");
    return { html: document.documentElement.dataset.duetInspector ?? "closed", pane: a ? (a.hasAttribute("data-full") ? "full" : "split") : "closed" };
  });
  expect(at.html).toBe(at.pane);
  return at.pane;
}
const title = (page: Page) => pane(page).locator("h2").textContent();
const tapCard = (page: Page, id: string) => page.locator(`[data-card="${id}"] h2`).click();
const expectLevel = (page: Page, want: string) => expect.poll(() => level(page)).toBe(want);

test("a tap opens the pane beside the overview, Full screen gives it the window, Back and Escape step down", async ({ page }) => {
  await load(page);
  await tapCard(page, "rent");
  await expectLevel(page, "split");
  expect(await title(page)).toBe("Rent");
  await expect(pane(page).locator("h2")).toBeFocused();
  await expect(pane(page)).toHaveAttribute("role", "dialog");
  await expect(pane(page)).not.toHaveAttribute("aria-modal", "true");
  await expect(page.locator(".ilab-weeks")).toHaveCount(0);
  await command(page, "Full screen").click();
  await expectLevel(page, "full");
  await expect(page.locator(".ilab-weeks")).toBeVisible();
  await expect(command(page, "Side by side")).toBeVisible();
  await page.keyboard.press("Escape");
  await expectLevel(page, "split");
  await page.keyboard.press("Escape");
  await expectLevel(page, "closed");
});

test("a link inside a card is the link's, not the card's", async ({ page }) => {
  await load(page);
  await page.locator('[data-source="groceries"]').click();
  await expect(page).toHaveURL(/#groceries-source$/);
  expect(await level(page)).toBe("closed");
});

test("the browser's Back and Forward walk the levels", async ({ page }) => {
  await load(page);
  await tapCard(page, "transit");
  await expectLevel(page, "split");
  await command(page, "Full screen").click();
  await expectLevel(page, "full");
  await page.goBack();
  await expectLevel(page, "split");
  expect(await title(page)).toBe("Transit");
  await page.goBack();
  await expectLevel(page, "closed");
  await page.goForward();
  await expectLevel(page, "split");
  await page.goForward();
  await expectLevel(page, "full");
  expect(await title(page)).toBe("Transit");
  // Close goes straight to the overview, however deep.
  await command(page, "Close").click();
  await expectLevel(page, "closed");
});

test("the arrows and Previous / Next step through the cards, and Back after stepping leaves", async ({ page }) => {
  await load(page);
  await tapCard(page, "rent");
  await expectLevel(page, "split");
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => title(page)).toBe("Groceries");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => title(page)).toBe("Leisure");
  await command(page, "Next card").click();
  await expect.poll(() => title(page)).toBe("Rent");
  await command(page, "Previous card").click();
  await expect.poll(() => title(page)).toBe("Leisure");
  // Arrows in a field move the caret, not the card.
  await pane(page).getByPlaceholder("Add a note").focus();
  await page.keyboard.press("ArrowDown");
  expect(await title(page)).toBe("Leisure");
  await page.goBack();
  await expectLevel(page, "closed");
});

test("focus goes back to the inspect button that opened the card", async ({ page }) => {
  await load(page);
  const button = page.getByRole("button", { name: "Inspect Utilities" });
  await button.click();
  await expectLevel(page, "split");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expectLevel(page, "closed");
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  // And after the browser's Back.
  await button.click();
  await expectLevel(page, "split");
  await page.goBack();
  await expectLevel(page, "closed");
  await expect(button).toBeFocused();
  // A tap on the card: back to its inspect button, the card itself takes no focus.
  await tapCard(page, "rent");
  await expectLevel(page, "split");
  await command(page, "Close").click();
  await expectLevel(page, "closed");
  await expect(page.getByRole("button", { name: "Inspect Rent" })).toBeFocused();
});

test("full screen is modal: aria-modal and the page inert", async ({ page }) => {
  await load(page, { width: 820, height: 1180 });
  await tapCard(page, "savings");
  // No room for two panes: straight to full screen, one entry deep.
  await expectLevel(page, "full");
  await expect(pane(page)).toHaveAttribute("aria-modal", "true");
  await expect(page.locator("main.ilab-overview")).toHaveJSProperty("inert", true);
  await expect(command(page, "Full screen")).toHaveCount(0);
  await expect(command(page, "Side by side")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expectLevel(page, "closed");
  await expect(page.locator("main.ilab-overview")).toHaveJSProperty("inert", false);
});

test("a narrowed window takes an open pane full screen", async ({ page }) => {
  await load(page);
  await tapCard(page, "leisure");
  await expectLevel(page, "split");
  await page.setViewportSize({ width: 1049, height: 900 });
  await expectLevel(page, "full");
});

test("repairHistory writes the level back after a router drops it", async ({ page }) => {
  await load(page);
  await tapCard(page, "groceries");
  await expectLevel(page, "split");
  await command(page, "Full screen").click();
  await expectLevel(page, "full");
  // Under the full screen entry, the pane's: drop ours from it, as a router's replaceState does.
  await page.goBack();
  await expectLevel(page, "split");
  await page.evaluate(() => history.replaceState(null, ""));
  await expect.poll(() => page.evaluate(() => (history.state as { duetInspector?: { selected: string; full: boolean } } | null)?.duetInspector)).toEqual({ selected: "groceries", full: false, depth: 1 });
  await page.goForward();
  await expectLevel(page, "full");
  await page.goBack();
  await expectLevel(page, "split");
  expect(await title(page)).toBe("Groceries");
});

for (const size of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }, { width: 1032, height: 1376 }, { width: 1376, height: 1032 }, { width: 1049, height: 820 }, { width: 1050, height: 820 }, { width: 1051, height: 820 }, { width: 1440, height: 900 }]) {
  test(`the column stands inside the window with 44pt targets at ${size.width}x${size.height}`, async ({ page }) => {
    await load(page, size);
    await page.getByRole("button", { name: "Inspect Rent" }).click();
    await expectLevel(page, size.width >= 1050 ? "split" : "full");
    const bar = column(page);
    await expect(bar).toHaveAttribute("aria-orientation", "vertical");
    const box = (await bar.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    const buttons = bar.getByRole("button");
    const n = await buttons.count();
    expect(n).toBe(size.width >= 1050 ? 4 : 3);
    for (let i = 0; i < n; i++) {
      const b = buttons.nth(i);
      const r = (await b.boundingBox())!;
      expect(r.width).toBeGreaterThanOrEqual(44);
      expect(r.height).toBeGreaterThanOrEqual(44);
      expect(r.x + r.width).toBeLessThanOrEqual(size.width);
      expect(r.y + r.height).toBeLessThanOrEqual(size.height);
      await expect(b).toHaveAttribute("data-duet-control", "actions");
      await expect(b).toHaveAttribute("aria-label", /.+/);
    }
    // The pane's text keeps clear of the column.
    const head = (await pane(page).locator("h2").boundingBox())!;
    expect(head.x + head.width).toBeLessThanOrEqual(box.x);
  });
}

test("a viewer holds focus, steps through its group, closes on Escape and gives focus back", async ({ page }) => {
  await load(page);
  const trigger = page.locator('[data-figure="fig-month"]');
  await trigger.click();
  const open = page.locator("dialog.duet-viewer[open]");
  await expect(open).toHaveCount(1);
  await expect(open.locator("h2")).toHaveText("The month by week");
  await expect(open.locator("h2")).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  // Tab goes round inside: Close, Previous, Next, then Close again.
  const names: string[] = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    names.push(await page.evaluate(() => {
      const a = document.activeElement as HTMLElement;
      return a.closest("dialog[open]") ? a.getAttribute("aria-label") ?? a.tagName : "outside";
    }));
  }
  expect(names).toEqual(["Close", "Previous", "Next", "Close"]);
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe("Next");
  // The arrows and the column step through the group in document order, round the ends.
  await page.keyboard.press("ArrowDown");
  await expect(open.locator("h2")).toHaveText("Share of spending");
  await open.getByRole("button", { name: "Next" }).click();
  await expect(open.locator("h2")).toHaveText("The year so far");
  await open.getByRole("button", { name: "Next" }).click();
  await expect(open.locator("h2")).toHaveText("The month by week");
  await open.getByRole("button", { name: "Previous" }).click();
  await expect(open.locator("h2")).toHaveText("The year so far");
  await expect(page.locator("dialog.duet-viewer[open]")).toHaveCount(1);
  // The inspector leaves the keys to the viewer.
  expect(await level(page)).toBe("closed");
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog.duet-viewer[open]")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("a viewer's Close gives focus back to its own trigger", async ({ page }) => {
  await load(page);
  const trigger = page.locator('[data-figure="fig-share"]');
  await trigger.click();
  await page.locator("dialog.duet-viewer[open]").getByRole("button", { name: "Close" }).click();
  await expect(page.locator("dialog.duet-viewer[open]")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
