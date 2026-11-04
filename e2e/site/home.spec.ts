// The home page is one short page: the live simulator, how Duet works, the examples, install. The simulator is the
// interactive 3D Duo with prod's controls (turns, fold, Device, Surface, Layout, System UI, With or Without Duet) on the skeleton site.
import { expect, test } from "@playwright/test";
import { GPU, stageReady } from "./site";

test.use(GPU);

const onScreen = (page: import("@playwright/test").Page, path: string) =>
  expect.poll(() => page.frames().some((f) => f.url().includes(path)), { message: `the simulator runs ${path}`, timeout: 20_000 }).toBe(true);

test("four sections, in order, and no tour", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main > section[id]")).toHaveCount(4);
  expect(await page.locator("main > section[id]").evaluateAll((s) => s.map((e) => e.id))).toEqual(["simulator", "how", "examples", "install"]);
  await expect(page.locator("#tour")).toHaveCount(0);
  await expect(page.locator("main video")).toHaveCount(0);
});

test("the simulator is the live Duo with its controls, and no presets", async ({ page }) => {
  await page.goto("/");
  const sim = page.getByTestId("simulator");
  await stageReady(page);
  await expect(sim.getByRole("radio", { name: "With Duet" })).toBeVisible();
  for (const name of ["Closed", "Open", "Tent", "Laptop"]) await expect(sim.getByRole("button", { name, exact: true }).first()).toBeVisible();
  await expect(sim.getByText("System UI", { exact: true }).first()).toBeVisible();
  await expect(sim.getByRole("group", { name: "Moments" })).toHaveCount(0);
  await expect(sim.getByRole("button", { name: "Sidebar", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("app-picker")).toHaveCount(0);
  await onScreen(page, "/skeleton");
  expect((await page.request.get("/skeleton")).status()).toBe(200);
});

test("the controls under the device hold still as the posture changes", async ({ page }) => {
  await page.goto("/");
  await stageReady(page);
  const sim = page.getByTestId("simulator");
  const top = () => sim.getByRole("radio", { name: "With Duet" }).evaluate((e) => Math.round(e.getBoundingClientRect().top + scrollY));
  const before = await top();
  for (const name of ["Closed", "Tent", "Laptop", "Open"]) {
    await sim.getByRole("button", { name, exact: true }).first().click();
    await page.waitForTimeout(600);
    expect(await top(), name).toBe(before);
  }
});

test("an example shows its source", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("#examples article", { hasText: "Inbox" });
  await card.getByText(/code/i).first().click();
  await expect(card.locator("pre")).toContainText("<Duet");
});

test("each example has a looping demo of what its controls do", async ({ page }) => {
  await page.goto("/");
  const demos = page.locator("#examples .exd");
  await expect(demos).toHaveCount(3);
  expect(await demos.evaluateAll((d) => d.map((e) => e.getAttribute("data-demo")))).toEqual(["inbox", "checkout", "reader"]);
  expect(await demos.first().evaluate((e) => e.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
});

test("off a Duo the top bar keeps its links and Duet draws nothing", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".nav-links")).toBeVisible();
  await expect(page.locator("[data-duet-control]")).toHaveCount(0);
});

test.describe("on a Duo", () => {
  test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1", screen: { width: 466, height: 678 }, viewport: { width: 466, height: 678 } });

  test("the sections are Duet's places and the top bar keeps the name only", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-duet-control]").first()).toBeVisible();
    await expect(page.locator(".nav-links")).toBeHidden();
    await expect(page.locator(".nav-brand")).toBeVisible();
  });
});

// Safari's column, emulated: the home page in a frame the size of a closed Duo, sent the signals a fresh tab gives (as
// the web Duo does). The document scrolls, so the sidebar has to open where the reader is, not at the document top.
test.describe("in Safari's column", () => {
  const SIGNALS = {
    innerWidth: 382, innerHeight: 580, outerWidth: 466, outerHeight: 678, visualHeight: 580, screenWidth: 466, screenHeight: 678,
    insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0, standalone: false, pixelRatio: 3,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1",
  };
  const host = `<!doctype html><body style="margin:0"><iframe src="/" style="width:466px;height:678px;border:0"></iframe><script>
    addEventListener("message", (e) => { if (e.data?.type === "duet:ready") e.source.postMessage({ type: "duet:signals", signals: ${JSON.stringify(SIGNALS)} }, location.origin); });
  </script></body>`;

  for (const at of ["simulator", "examples", "install"]) {
    test(`the sidebar opens in view at #${at}`, async ({ page }) => {
      await page.route("**/__column-host", (r) => r.fulfill({ contentType: "text/html", body: host }));
      await page.goto("/__column-host");
      const frame = page.frames().find((f) => f !== page.mainFrame())!;
      const app = page.frameLocator("iframe");
      const burger = app.locator('[data-duet-control="sidebar"]');
      await expect(burger).toBeVisible({ timeout: 15_000 });
      await frame.evaluate((id) => { const el = document.getElementById(id)!; scrollTo({ top: el.getBoundingClientRect().top + scrollY, behavior: "instant" }); }, at);
      await page.waitForTimeout(400);
      await burger.click();
      const sidebar = app.locator("nav.duet-sidebar[data-open]");
      await expect(sidebar).toBeVisible();
      await page.waitForTimeout(600);
      const box = await sidebar.evaluate((e) => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; });
      expect(box.top, `sidebar top at #${at}`).toBe(0);
      expect(box.bottom).toBeGreaterThan(box.vh / 2);
      // Its places work from there, and a second press closes it.
      await app.locator("nav.duet-sidebar .duet-side-row", { hasText: "How it works" }).click();
      await expect(sidebar).toHaveCount(0);
      await expect.poll(() => frame.evaluate(() => Math.round(document.getElementById("how")!.getBoundingClientRect().top))).toBeLessThan(80);
    });
  }

  // Over the page it fades from and to nothing: from a 60% rest it popped in half drawn, and closing it hung half faded then vanished.
  test("the sidebar fades in and out from nothing", async ({ page }) => {
    await page.route("**/__column-host", (r) => r.fulfill({ contentType: "text/html", body: host }));
    await page.goto("/__column-host");
    const app = page.frameLocator("iframe");
    const burger = app.locator('[data-duet-control="sidebar"]');
    await expect(burger).toBeVisible({ timeout: 15_000 });
    const nav = app.locator("nav.duet-sidebar[data-overlay]");
    const opacity = () => nav.evaluate((e) => Number(getComputedStyle(e).opacity));
    expect(await opacity(), "at rest, closed").toBe(0);
    await burger.click();
    await expect(nav).toHaveAttribute("data-open");
    await expect.poll(opacity).toBe(1);
    await app.locator("nav.duet-sidebar .duet-side-row", { hasText: "Examples" }).click();
    await expect(nav).not.toHaveAttribute("data-open");
    // Still visible while it leaves: by then it is nearly gone, not caught at 60%.
    await expect.poll(() => nav.evaluate((e) => getComputedStyle(e).visibility)).toBe("hidden");
    expect(await opacity(), "when it hides").toBeLessThan(0.15);
  });
});
