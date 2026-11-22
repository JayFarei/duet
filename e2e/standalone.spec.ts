import { expect, test, type Page } from "@playwright/test";

// Home Screen (standalone) web app on an iPad: the control column stays docked in its rail. A sideways drag across
// the page and a long vertical drag must not carry it out of the rail or leave it displaced: the same rects after
// the release, no --duet-drag and no data-drag left behind. Without moveControls it must not follow the finger at
// all; with moveControls it may switch sides but only by snapping into the other rail.
// Standalone is emulated (navigator.standalone + display-mode: standalone); the Duo run drives the real thing
// (tools/e2e, suites sa*). WEALTH_OLD_URL / WEALTH_NEW_URL add a consumer app (synthetic fixture only).
const SIZES = [
  { name: "iPad landscape", width: 1180, height: 820 },
  { name: "iPad portrait", width: 820, height: 1180 },
];

test.use({ hasTouch: true });

async function standalone(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "standalone", { configurable: true, get: () => true });
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => {
      if (!/display-mode\s*:\s*standalone/.test(q)) return mm(q);
      return { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {},
        removeEventListener() {}, dispatchEvent: () => false } as unknown as MediaQueryList;
    };
  });
}

type R = { x: number; y: number; w: number; h: number };
/** Every column group's rect, plus anything a drag could leave behind. */
const probe = (page: Page) => page.evaluate(() => {
  const groups = [...document.querySelectorAll<HTMLElement>(".duet .duet-group")].filter((e) => e.getBoundingClientRect().width);
  const rects = groups.map((e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x * 2) / 2, y: Math.round(b.y * 2) / 2, w: Math.round(b.width * 2) / 2, h: Math.round(b.height * 2) / 2 }; });
  const left = [...document.querySelectorAll<HTMLElement>("[style*='--duet-drag'], [data-drag]")].map((e) => e.className || e.tagName);
  return { rects, left, W: innerWidth, H: innerHeight, standalone: [(navigator as { standalone?: boolean }).standalone === true, matchMedia("(display-mode: standalone)").matches] };
});

/** Docked: inside the window, against one of its side edges (the rail), all groups on the same side. */
function docked(p: { rects: R[]; W: number; H: number }) {
  const sides = p.rects.map((r) => (r.x + r.w / 2 > p.W / 2 ? "right" : "left"));
  const bad = p.rects.filter((r) => r.x < -0.5 || r.x + r.w > p.W + 0.5 || r.y < -0.5 || r.y + r.h > p.H + 0.5);
  const gap = p.rects.map((r, i) => (sides[i] === "right" ? p.W - (r.x + r.w) : r.x));
  return { inside: bad.length === 0, oneSide: new Set(sides).size <= 1, side: sides[0], maxGap: Math.max(0, ...gap) };
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 24) {
  let mid: R[] = [];
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    if (i === Math.round(steps * 0.75)) mid = (await probe(page)).rects;
  }
  await page.mouse.up();
  await page.waitForTimeout(700); // the snap and the press release settle
  return mid;
}

/** The control a person grabs: the group's last button (a command, not "…" when there is one). */
async function grip(page: Page) {
  const b = (await page.locator(".duet .duet-group .duet-btn:visible").last().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Mid-drag, still in its rail (tools/e2e/EXPECTED.md "Home Screen web app"): the held capsule may open to the press
 * width (press.ts PRESS.width 78.8, spring overshoot) centred on its rest x and drift a little with the finger; a side
 * switch moves its centre a whole window. */
const PRESS_W = 92;
const inRail = (a: R[], b: R[]) => a.length === b.length && a.every((r, i) =>
  Math.abs(r.x + r.w / 2 - (b[i].x + b[i].w / 2)) <= 4 && Math.abs(r.y + r.h / 2 - (b[i].y + b[i].h / 2)) <= 40 && r.w <= Math.max(PRESS_W, b[i].w * 1.15));

type Target = { id: string; url: string; move?: boolean; app?: boolean; prepare?: (page: Page) => Promise<void> };
const TARGETS: Target[] = [
  { id: "site lab", url: "/lab?tabs=5,searchTab=1,back=1,actions=2,title=1,feed=1,bar=1" },
  { id: "site lab, moveControls", url: "/lab?tabs=5,searchTab=1,back=1,actions=2,title=1,feed=1,bar=1,move=1", move: true },
  { id: "inspector lab, pane open", url: "/lab/inspector?plain", prepare: async (page) => {
    await page.locator('[data-card="rent"] h2').click();
    await expect(page.locator("aside.duet-inspector")).toBeVisible();
    await page.waitForTimeout(500);
  } },
  ...(process.env.WEALTH_OLD_URL ? [{ id: "wealth old", url: process.env.WEALTH_OLD_URL, app: true }] : []),
  ...(process.env.WEALTH_NEW_URL ? [{ id: "wealth new", url: process.env.WEALTH_NEW_URL, app: true }] : []),
];

for (const t of TARGETS) {
  for (const size of SIZES) {
    test(`standalone ${t.id}, ${size.name} ${size.width}x${size.height}: the column stays in its rail through a sideways and a long vertical drag`, async ({ page }) => {
      await standalone(page);
      await page.setViewportSize(size);
      await page.goto(t.url);
      const mounted = await page.locator(".duet .duet-group").first().waitFor({ timeout: t.app ? 8000 : 30000 }).then(() => true, () => false);
      // A consumer app may keep its own desktop layout at iPad sizes and never mount the Duet column.
      test.skip(!mounted && !!t.app, `${t.id} mounts no Duet column at ${size.width}x${size.height}`);
      expect(mounted).toBe(true);
      await page.waitForTimeout(800);
      await t.prepare?.(page);
      const before = await probe(page);
      expect(before.standalone).toEqual([true, true]);
      expect(before.rects.length).toBeGreaterThan(0);
      const d0 = docked(before);
      expect(d0.inside && d0.oneSide, `docked before: ${JSON.stringify(before.rects)}`).toBe(true);

      // Sideways, across the middle to the far side, slowly.
      const g = await grip(page);
      const far = g.x > before.W / 2 ? 40 : before.W - 40;
      const mid = await drag(page, g, { x: far, y: g.y + 6 });
      const after = await probe(page);
      expect(after.left, "a drag leaves nothing behind").toEqual([]);
      const d1 = docked(after);
      expect(d1.inside && d1.oneSide, `docked after the sideways drag: ${JSON.stringify(after.rects)}`).toBe(true);
      if (t.move) {
        // It may switch, but only into a rail: flush with the edge it was flush with before.
        expect(d1.maxGap).toBeLessThanOrEqual(d0.maxGap + 1);
      } else {
        expect(inRail(mid, before.rects), `no flash out of the rail mid-drag: ${JSON.stringify(mid)} vs ${JSON.stringify(before.rects)}`).toBe(true);
        expect(after.rects).toEqual(before.rects);
      }

      // Long vertical drag along the rail.
      const settled = after.rects;
      const v = await grip(page);
      const vmid = await drag(page, v, { x: v.x, y: v.y < before.H / 2 ? before.H - 40 : 40 }, 30);
      const end = await probe(page);
      expect(end.left).toEqual([]);
      expect(inRail(vmid, settled), `no flash mid vertical drag: ${JSON.stringify(vmid)}`).toBe(true);
      expect(end.rects).toEqual(settled);
    });
  }
}
