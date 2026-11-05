import { expect, test, type FrameLocator, type Page } from "@playwright/test";

// The /qa page in Safari's column, emulated like home.spec.ts: a closed Duo's frame sent a fresh tab's signals. Each
// scenario counts the target's pointerdowns (taps) and clicks; a swallowed tap is one Duet stopped from reaching the page.
const SIGNALS = {
  innerWidth: 382, innerHeight: 580, outerWidth: 466, outerHeight: 678, visualHeight: 580, screenWidth: 466, screenHeight: 678,
  insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0, standalone: false, pixelRatio: 3,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1",
};
const host = `<!doctype html><body style="margin:0"><iframe src="/qa" style="width:466px;height:678px;border:0"></iframe><script>
  addEventListener("message", (e) => { if (e.data?.type === "duet:ready") e.source.postMessage({ type: "duet:signals", signals: ${JSON.stringify(SIGNALS)} }, location.origin); });
</script></body>`;

async function open(page: Page, scenario?: string): Promise<FrameLocator> {
  await page.route("**/__qa-host", (r) => r.fulfill({ contentType: "text/html", body: host }));
  await page.goto("/__qa-host");
  const app = page.frameLocator("iframe");
  await expect(app.locator("nav.duet [data-duet-control]").first()).toBeVisible({ timeout: 15_000 });
  if (scenario) await app.getByRole("button", { name: scenario }).click();
  await expect(app.locator("#target")).toContainText("taps 0 · clicks 0");
  return app;
}
const tap = async (app: FrameLocator, n = 1) => { for (let i = 0; i < n; i++) await app.locator("#target").click(); };
const settle = (page: Page) => page.waitForTimeout(700);

test.describe("QA page in Safari's column", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 466, "needs room for the 466pt Duo frame");

  test("#262: after a \"…\" row removes \"…\", every tap reaches the page", async ({ page }) => {
    const app = await open(page);
    await tap(app, 2);
    await expect(app.locator("#target")).toContainText("taps 2 · clicks 2");
    await app.locator('nav.duet [data-duet-control="more"]').click();
    await app.locator(".duet-row", { hasText: "New check" }).click();
    await expect(app.locator("#last")).toHaveText("New check");
    await expect(app.locator('nav.duet [data-duet-control="more"]')).toHaveCount(0);
    await settle(page);
    await tap(app, 6);
    await expect(app.locator("#target")).toContainText("taps 8 · clicks 8 · swallowed 0");
  });

  test("#253a: the tap that closes an open \"…\" is swallowed, the next one is not", async ({ page }) => {
    const app = await open(page, "#253a: tap outside an open \"…\"");
    await app.locator('nav.duet [data-duet-control="more"]').click();
    await expect(app.locator(".duet-row").first()).toBeVisible();
    await tap(app);
    await expect(app.locator("#target")).toContainText("swallowed 1");
    await settle(page);
    await tap(app, 3);
    await expect(app.locator("#target")).toContainText("taps 4 · clicks 3 · swallowed 1");
  });

  test("the primary's confirm box: an outside tap closes it and is swallowed, Book it runs", async ({ page }) => {
    const app = await open(page, "Primary confirm box");
    await app.locator('nav.duet [data-duet-control="primary"]').click();
    await expect(app.locator(".duet-confirm")).toBeVisible();
    await tap(app);
    await expect(app.locator("#target")).toContainText("swallowed 1");
    await expect(app.locator(".duet-confirm")).toHaveCount(0);
    await settle(page);
    await tap(app, 2);
    await expect(app.locator("#target")).toContainText("taps 3 · clicks 2 · swallowed 1");
    await app.locator('nav.duet [data-duet-control="primary"]').click();
    await app.locator(".duet-confirm").click();
    await expect(app.locator("#last")).toHaveText("Book ran");
  });
});
