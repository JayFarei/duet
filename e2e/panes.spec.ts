import { expect, test, type Page } from "@playwright/test";

// <DuetPanes> on the site's mail demo: one pane folded, two unfolded, back along the path, and state that
// survives the fold (panes stay mounted, only the track reflows).
const OPEN = { width: 951, height: 543 };
const PANE = { width: 385, height: 571 };

async function open(page: Page) {
  await page.goto("/panes?plain");
  await page.locator(".duet-panes").waitFor();
  await page.waitForTimeout(600);
}
/** Ids of the panes inside the panes box (it clips the rest), left to right. */
const shown = (page: Page) => page.evaluate(() => {
  const box = document.querySelector(".duet-panes")!.getBoundingClientRect();
  return [...document.querySelectorAll<HTMLElement>(".duet-pane")]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.right > box.left + 1 && r.left < box.right - 1; })
    .map((e) => e.dataset.pane);
});
const settle = (page: Page) => page.waitForTimeout(700);

test("narrow shows one pane and back steps along the path", async ({ page }) => {
  await page.setViewportSize(PANE);
  await open(page);
  expect(await shown(page)).toEqual(["mailboxes"]);
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
  await page.getByRole("button", { name: /Inbox/ }).click(); await settle(page);
  await page.getByRole("button", { name: /Fold test results/ }).click(); await settle(page);
  expect(await shown(page)).toEqual(["message"]);
  await page.getByRole("button", { name: "Back" }).click(); await settle(page);
  expect(await shown(page)).toEqual(["inbox"]);
});

test("wide shows the focused pane beside the one before it", async ({ page }) => {
  await page.setViewportSize(OPEN);
  await open(page);
  expect(await shown(page)).toEqual(["mailboxes", "inbox"]);
  await page.getByRole("button", { name: /Fold test results/ }).click(); await settle(page);
  expect(await shown(page)).toEqual(["inbox", "message"]);
  await page.getByRole("button", { name: "Back" }).click(); await settle(page);
  expect(await shown(page)).toEqual(["mailboxes", "inbox"]);
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
});

test("a draft survives folding and unfolding", async ({ page }) => {
  await page.setViewportSize(OPEN);
  await open(page);
  await page.getByRole("button", { name: /Fold test results/ }).click(); await settle(page);
  await page.getByPlaceholder("Write a reply").fill("Looks great");
  await page.setViewportSize(PANE); await settle(page);
  expect(await shown(page)).toEqual(["message"]);
  await expect(page.getByPlaceholder("Write a reply")).toHaveValue("Looks great");
  await page.setViewportSize(OPEN); await settle(page);
  expect(await shown(page)).toEqual(["inbox", "message"]);
  await expect(page.getByPlaceholder("Write a reply")).toHaveValue("Looks great");
});
