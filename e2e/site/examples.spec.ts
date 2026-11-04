// T6: the three example blocks, each exercising its nouns on the live stage (PLAN 6). Red until step 4.
import { expect, test, type Page } from "@playwright/test";
import { duetFrames, duetState, tap } from "./site";

// The live stage loads a 3D scene and four nested pages before Duet runs, slow under parallel workers.
test.describe.configure({ timeout: 120_000 });

async function posture(page: Page, name: "Closed" | "Open" | "Laptop" | "Sideways") {
  await page.getByTestId("posture").getByRole("button", { name, exact: true }).click();
  await page.waitForTimeout(1500);
}

/** The live stage's Duet frame (the first screen running Duet), or the page itself on a bare route. */
async function duet(page: Page) {
  await expect.poll(async () => (await duetFrames(page)).length, { message: "Duet runs", timeout: 45_000 }).toBeGreaterThan(0);
  return (await duetFrames(page))[0];
}

test.describe("Inbox", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, "at 390 the block shows its recorded loop, not the stage");

  // The Laptop's inner screen stands taller than the open one, so it holds all nine tabs and the Actions too.
  test("Closed gives sidebar, Open and Laptop give tabs", async ({ page }) => {
    await page.goto("/examples/inbox");
    await posture(page, "Closed");
    expect((await duetState(page)).map((s) => s.fit)).toContain("sidebar");
    await posture(page, "Open");
    expect((await duetState(page)).map((s) => s.fit)).toContain("tabs");
    await posture(page, "Laptop");
    expect((await duetState(page)).map((s) => s.fit)).toContain("tabs");
  });

  test("a row opens a sheet and the controls become Close", async ({ page }) => {
    await page.goto("/examples/inbox");
    await duet(page);
    await tap(page, '[data-testid="inbox-row"]');
    await expect.poll(async () => (await duetState(page)).map((s) => s.controls), { timeout: 15_000 }).toContainEqual(["close"]);
    await tap(page, '[data-duet-control="close"]');
    await expect.poll(async () => (await duetState(page)).flatMap((s) => s.controls), { timeout: 15_000 }).not.toContain("close");
  });
});

test.describe("Checkout", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, "at 390 the block shows its recorded loop, not the stage");

  test("Pay grows into the confirm box", async ({ page }) => {
    await page.goto("/examples/checkout");
    await duet(page);
    const f = await tap(page, '[data-duet-control="primary"]');
    await expect(f.locator(".duet-confirm")).toBeVisible();
  });

  test("Sideways folds Primary into More: first tap arms, second runs", async ({ page }) => {
    await page.goto("/examples/checkout");
    await posture(page, "Sideways");
    const f = await duet(page);
    expect(await f.locator('[data-duet-control="primary"]').count(), "no Primary button of its own").toBe(0);
    await f.locator('[data-duet-control="more"]').click();
    const row = f.locator('.duet-row[data-cta]');
    await row.click();
    await expect(row).toHaveAttribute("data-armed", "true");
    await row.click();
    await expect(f.getByTestId("checkout-paid")).toBeVisible();
  });
});

test.describe("Reader", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, "at 390 the block shows its recorded loop, not the stage");

  test("Pane bar Close and Full screen work", async ({ page }) => {
    await page.goto("/examples/reader");
    await posture(page, "Open");
    await duet(page);
    const f = await tap(page, '.duet-pane-bar [aria-label="Full screen"]');
    await expect(f.locator("[data-pane-full]")).toHaveCount(1);
    await f.locator('.duet-pane-bar [aria-label="Close"]').first().click();
    await expect(f.locator("[data-pane-full]")).toHaveCount(0);
  });
});

for (const name of ["inbox", "checkout", "reader"]) {
  test(`Open in new tab runs Duet on /examples/${name}`, async ({ page }) => {
    await page.goto(`/examples/${name}`);
    const href = await page.getByRole("link", { name: /open in new tab|^open$/i }).first().getAttribute("href");
    expect(href).toMatch(new RegExp(`^/examples/${name}\\?plain`));
    await page.goto(href!);
    await expect(page.locator("nav.duet:not(.duet-sidebar) .duet-group").first()).toBeVisible();
  });
}
