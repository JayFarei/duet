// T6: the three example blocks, each exercising its nouns on the live stage (PLAN 6). Red until step 4.
import { expect, test, type Page } from "@playwright/test";
import { GPU, duetFrames, duetState, tap } from "./site";

test.use(GPU);

// The live stage loads a 3D scene and four nested pages before Duet runs, slow under parallel workers.
test.describe.configure({ timeout: 120_000 });

async function posture(page: Page, name: "Closed" | "Open" | "Laptop" | "Sideways") {
  await page.getByTestId("posture").getByRole("button", { name, exact: true }).click();
  await page.waitForTimeout(1500);
}

/** The live stage's Duet frame (the first screen running Duet), or the page itself on a bare route. The stage starts
 *  locked so the page scrolls over it: "Use the device" hands it the pointer first. */
async function duet(page: Page) {
  const use = page.getByRole("button", { name: "Use the device" });
  if (await use.isVisible()) await use.click();
  await expect.poll(async () => (await duetFrames(page)).length, { message: "Duet runs", timeout: 45_000 }).toBeGreaterThan(0);
  return (await duetFrames(page))[0];
}

test.describe("Inbox", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, "at 390 the block shows its recorded loop, not the stage");

  // The Laptop's inner screen stands taller than the open one, so it holds all nine tabs and the Actions too.
  test("Closed gives sidebar, Open and Laptop give tabs", async ({ page }) => {
    await page.goto("/examples/inbox");
    await duet(page);
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

for (const name of ["inbox", "checkout", "reader", "inspector"]) {
  test(`Open in new tab runs Duet on /examples/${name}, with a way back`, async ({ page }) => {
    await page.goto(`/examples/${name}`);
    const href = await page.getByRole("link", { name: /open in new tab|^open$/i }).first().getAttribute("href");
    expect(href).toMatch(new RegExp(`^/examples/${name}\\?plain`));
    await page.goto(href!);
    await expect(page.locator("nav.duet:not(.duet-sidebar) .duet-group").first()).toBeVisible();
    const back = page.getByTestId("plain-back");
    await expect(back).toHaveAttribute("href", `/examples/${name}`);
    await back.click();
    await expect(page).toHaveURL(new RegExp(`/examples/${name}$`));
  });

  // The stage's screens load ?plain: the server must send the app alone, or they paint the example page first.
  test(`/examples/${name}?plain is the app alone from the first byte`, async ({ request }) => {
    const html = await (await request.get(`/examples/${name}?plain`)).text();
    expect(html).not.toContain("ex-page");
    expect(html).not.toContain("ex-seg");
    expect(html).not.toContain('class="nav"');
  });
}

test.describe("the stage lets the page scroll", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, "at 390 the block shows its recorded loop, not the stage");

  test("the wheel over the device scrolls the page until Use the device, Escape locks it again", async ({ page }) => {
    await page.goto("/examples/inbox");
    const stage = page.locator(".ex-frame");
    await stage.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    const box = (await stage.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 200));
    const y0 = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => scrollY), { message: "the page scrolls" }).toBeGreaterThan(y0 + 100);
    await page.getByRole("button", { name: "Use the device" }).click();
    await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Use the device" })).toBeVisible();
  });
});

test("the posture and the view are in the URL", async ({ page }) => {
  await page.goto("/examples/checkout?view=code");
  await expect(page.getByRole("tab", { name: "Code" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".ex-code")).toBeVisible();
  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page).toHaveURL(/\/examples\/checkout$/);
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await page.getByTestId("posture").getByRole("button", { name: "Open", exact: true }).click();
    await expect(page).toHaveURL(/\?posture=open$/);
    await page.reload();
    await expect(page.getByTestId("posture").getByRole("button", { name: "Open", exact: true })).toHaveAttribute("aria-pressed", "true");
  }
});

test("example pages carry the site's top bar", async ({ page }) => {
  for (const path of ["/examples", "/examples/inspector"]) {
    await page.goto(path);
    await expect(page.locator("header.nav")).toBeVisible();
    await expect(page.locator('header.nav a[href="/"]')).toBeVisible();
  }
});
