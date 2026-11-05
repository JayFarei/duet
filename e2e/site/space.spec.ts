// Differential oracle (#189): the site's web Duo mock against the real Duo Lab simulator's space map. /space draws one
// mock scene at 1:1 in screen points; this reads Duet's groups off the page in its iframe and the mock's own preview
// buttons ([data-wd-native]) and the signals it posts, and diffs them against fixtures/space-map.json, failing on any
// delta over 1pt. Duet's own band is not diffed: its rule changed after the map was measured (fixture duetUi), so the
// map's band ends are diffed as the signals that produced them.
// The same scenes also carry the placement invariant of #110 (tools/e2e contract): every shown control sits inside
// the window and clear of every native button.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

interface Ctx { id: string; label: string; state: Record<string, unknown>; mode: string; band?: { bottom: number }; signals?: Record<string, number>; native?: Record<string, { top: number }> }
const MAP = JSON.parse(readFileSync(join(__dirname, "fixtures/space-map.json"), "utf8")) as { source: string; ios: string; contexts: Ctx[] };
const SCREEN = { closed: { w: 466, h: 678 }, open: { w: 951, h: 669 } }; // web-duo.tsx SCREEN
const TOL = 1;

interface Rect { x: number; y: number; w: number; h: number }
interface Read { mode: string | null; hidden: boolean; groups: Rect[]; native: Record<string, Rect>; window: Rect; page: Rect; signals: Record<string, unknown>; screen: { w: number; h: number } }

async function readScene(page: Page, state: Record<string, unknown>): Promise<Read> {
  const n = SCREEN[state.posture as "closed" | "open"], screen = state.turn ? { w: n.h, h: n.w } : n;
  await page.setViewportSize({ width: screen.w, height: screen.h });
  await page.goto(`/space?s=${encodeURIComponent(JSON.stringify(state))}`);
  const frame = page.frameLocator("[data-space-clip] iframe");
  await frame.locator("nav.duet[data-mode][data-confidence]").first().waitFor({ state: "attached", timeout: 20_000 });
  const read = () => page.evaluate(() => {
    const scr = document.querySelector("[data-space-screen]")!.getBoundingClientRect();
    const clip = document.querySelector("[data-space-clip]")!.getBoundingClientRect();
    const ifr = document.querySelector<HTMLIFrameElement>("[data-space-clip] iframe")!, f = ifr.getBoundingClientRect(), doc = ifr.contentDocument!;
    const r = (b: DOMRect, ox: number, oy: number) => ({ x: +(b.x + ox).toFixed(1), y: +(b.y + oy).toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) });
    const nav = doc.querySelector("nav.duet:not(.duet-sidebar)");
    const groups = [...doc.querySelectorAll("nav.duet:not(.duet-sidebar) .duet-group:not([data-leaving])")].map((g) => r(g.getBoundingClientRect(), f.x - scr.x, f.y - scr.y)).filter((g) => g.w > 0 && g.h > 0);
    const native: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const e of document.querySelectorAll("[data-wd-native]")) native[e.getAttribute("data-wd-native")!] = r(e.getBoundingClientRect(), -clip.x, -clip.y);
    return { mode: nav?.getAttribute("data-mode") ?? null, hidden: !!nav?.hasAttribute("data-hidden"), settling: !!nav?.hasAttribute("data-settling"), groups, native, window: r(clip, -scr.x, -scr.y), page: r(f, -scr.x, -scr.y),
      signals: JSON.parse(document.querySelector("[data-space-screen]")!.getAttribute("data-space-signals") || "{}") };
  });
  // Groups pop in on a spring and the mock's buttons move on a 520ms transition: wait until two reads agree.
  let last = "", out: Awaited<ReturnType<typeof read>> | undefined;
  for (const end = Date.now() + 15_000; Date.now() < end; await page.waitForTimeout(250)) {
    out = await read();
    const key = JSON.stringify(out);
    if (key === last && !out.settling && out.groups.length) break;
    last = key;
  }
  return { ...out!, screen };
}

test.describe("web Duo mock vs real sim", () => {
  test.beforeEach(({}, info) => test.skip(!info.project.name.endsWith("-1440"), "one viewport per engine: the scene sets its own size"));

  test(`matches the space map (iOS ${MAP.ios}, ${MAP.source})`, async ({ page }) => {
    const rows: { context: string; what: string; sim: string | number; mock: string | number; delta: string; ok: boolean }[] = [];
    for (const c of MAP.contexts) {
      const s = await readScene(page, { upside: false, pane: "right", live: false, ...c.state });
      rows.push({ context: c.id, what: "mode", sim: c.mode, mock: s.mode ?? "none", delta: "", ok: s.mode === c.mode });
      for (const [k, want] of Object.entries(c.signals ?? {})) {
        const got = Number(s.signals[k] ?? NaN);
        rows.push({ context: c.id, what: `signal ${k}`, sim: want, mock: Number.isNaN(got) ? "missing" : got, delta: (got - want).toFixed(1), ok: Math.abs(got - want) <= TOL });
      }
      if (c.band) { // the derivation of signals from band.bottom holds only with the page reaching the screen's foot
        const foot = s.page.y + s.page.h;
        rows.push({ context: c.id, what: "page bottom (screen)", sim: s.screen.h, mock: foot, delta: (foot - s.screen.h).toFixed(1), ok: Math.abs(foot - s.screen.h) <= TOL });
      }
      for (const [name, want] of Object.entries(c.native ?? {})) {
        const got = s.native[name];
        rows.push({ context: c.id, what: `${name} top (window)`, sim: want.top, mock: got ? got.y : "missing", delta: got ? (got.y - want.top).toFixed(1) : "", ok: !!got && Math.abs(got.y - want.top) <= TOL });
      }
    }
    const table = ["| context | what | real sim | mock | delta | |", "|---|---|---|---|---|---|",
      ...rows.map((r) => `| ${r.context} | ${r.what} | ${r.sim} | ${r.mock} | ${r.delta} | ${r.ok ? "ok" : "FAIL"} |`)].join("\n");
    await test.info().attach("space-map-diff.md", { body: table, contentType: "text/markdown" });
    const bad = rows.filter((r) => !r.ok);
    expect(bad.length, `web Duo mock differs from the real sim by more than ${TOL}pt:\n${table}`).toBe(0);
  });

  // #110's placement invariant, on the mock: a shown control is inside the window (the screen too) and covers no
  // native button. Per scene, so a failure names it.
  for (const c of MAP.contexts) {
    test(`invariant: ${c.label}`, async ({ page }) => {
      const s = await readScene(page, { upside: false, pane: "right", live: false, ...c.state });
      test.skip(s.hidden || !s.groups.length, "no gap, no button");
      const win = { x: 0, y: 0, w: s.window.w, h: s.window.h };
      const inside = (g: Rect, b: Rect) => g.x >= b.x - 0.5 && g.y >= b.y - 0.5 && g.x + g.w <= b.x + b.w + 0.5 && g.y + g.h <= b.y + b.h + 0.5;
      const meets = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      for (const g of s.groups) {
        const gw = { ...g, x: g.x - s.window.x, y: g.y - s.window.y }; // window points, as the native rects
        expect(inside(g, { x: 0, y: 0, ...s.screen }), `group ${JSON.stringify(g)} inside the screen ${JSON.stringify(s.screen)}`).toBe(true);
        expect(inside(gw, win), `group ${JSON.stringify(gw)} inside the window ${JSON.stringify(win)}`).toBe(true);
        for (const [name, b] of Object.entries(s.native)) expect(meets(gw, b), `group ${JSON.stringify(gw)} clear of native ${name} ${JSON.stringify(b)}`).toBe(false);
      }
    });
  }
});
