// Every device on the site shows whole: scrolled into view, a device frame (the 3D Duo's iframe, or the 2D web Duo)
// lies inside its container and the window, the device drawn in it does not touch the frame's edge (no bezel cut
// off), and with the line that introduces it at the top of the window the frame and its controls end inside it. The
// example cards' loops and animated demos lie inside their cards. The phone projects check 390x844; the laptop ones
// the tablet and laptop sizes, 1024x841 the review's (#279) short laptop.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { EXAMPLES } from "./site";

const WIDE = [[768, 1024], [1024, 768], [1024, 841], [1440, 900]] as const;
const FRAME = 'iframe[title="iPhone Duo, 3D"], .web-duo, .ex-frame .ex-loop'; // a phone gets the recorded loop

interface Fit { box: number[]; container: number[]; view: number[]; inContainer: boolean; inView: boolean; stageH: number }

/** Scrolls `el` to the middle of the window and measures it against its container and the window. */
async function fit(page: Page, el: Locator, container: string): Promise<Fit> {
  await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  return el.evaluate((e, container) => {
    const r = (x: DOMRect) => [x.left, x.top, x.right, x.bottom].map((n) => Math.round(n));
    const b = e.getBoundingClientRect(), c = (e.parentElement!.closest(container) ?? e.parentElement!).getBoundingClientRect();
    const v = { left: 0, top: 0, right: document.documentElement.clientWidth, bottom: document.documentElement.clientHeight } as DOMRect;
    const inside = (o: DOMRect) => b.left >= o.left - 0.5 && b.top >= o.top - 0.5 && b.right <= o.right + 0.5 && b.bottom <= o.bottom + 0.5;
    // The stage: the frame's wrapper and what Duo3D puts under it (its controls, or Use the device).
    if (e.tagName === "VIDEO" || e.classList.contains("ex-loop")) return { box: r(b), container: r(c), view: r(v), inContainer: inside(c), inView: inside(v), stageH: 0 };
    const stage = e.parentElement!.parentElement!, under = stage.children[1] as HTMLElement | undefined;
    const narrow = stage.clientWidth < 700, first = under?.firstElementChild as HTMLElement | null;
    const stageH = b.height + (under ? 14 + (narrow && first ? first.offsetHeight : under.offsetHeight) : 0);
    return { box: r(b), container: r(c), view: r(v), inContainer: inside(c), inView: inside(v), stageH };
  }, container);
}

/** True when the device drawn in the frame keeps clear of the frame's edge: the outer 2px ring is one flat colour. */
async function clearOfEdge(page: Page, frame: Locator): Promise<{ ok: boolean; worst: number; at: string }> {
  const b = (await frame.boundingBox())!;
  // 1px inside the frame: at a fractional position its edge row blends in the page next to it (a toolbar's hairline).
  const clip = { x: Math.ceil(b.x) + 1, y: Math.ceil(b.y) + 1, width: Math.floor(b.width) - 2, height: Math.floor(b.height) - 2 };
  const png = (await page.screenshot({ clip, scale: "css", animations: "disabled" })).toString("base64");
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const { data, width: w, height: h } = g.getImageData(0, 0, c.width, c.height);
    const lum = (x: number, y: number) => { const i = (y * w + x) * 4; return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; };
    // The background: the ring's median. One pixel can be off (a frame at a fractional y catches the hairline above).
    const ring: number[] = [];
    for (let x = 0; x < w; x++) ring.push(lum(x, 0), lum(x, h - 1));
    for (let y = 0; y < h; y++) ring.push(lum(0, y), lum(w - 1, y));
    ring.sort((a, b) => a - b);
    const ref = ring[ring.length >> 1];
    // A device cut off by the frame lies along its edge; a stray antialiased pixel does not. The corners are the
    // container's rounding, not the device.
    const R = 28, corner = (x: number, y: number) => (x < R || x >= w - R) && (y < R || y >= h - R);
    let worst = 0, at = "";
    const side = (name: string, n: number, xy: (i: number) => [number, number]) => {
      let run = 0;
      for (let i = 0; i < n; i++) {
        const [x, y] = xy(i);
        run = !corner(x, y) && Math.abs(lum(x, y) - ref) > 24 ? run + 1 : 0;
        if (run > worst) { worst = run; at = `${name} ${x},${y}`; }
      }
    };
    for (let k = 0; k < 2; k++) {
      side("top", w, (i) => [i, k]); side("bottom", w, (i) => [i, h - 1 - k]);
      side("left", h, (i) => [k, i]); side("right", h, (i) => [w - 1 - k, i]);
    }
    return { ok: worst < 6, worst, at };
  }, png);
}

async function frames(page: Page, path: string) {
  await page.goto(path);
  const frame = page.locator(FRAME).first();
  // A phone with no recorded loop for the example gets a text card in the frame: no device to check.
  await page.locator(`${FRAME}, .ex-frame .ex-card`).first().waitFor({ timeout: 20_000 });
  if (!(await frame.count())) return;
  // The 3D Duo draws once its page has loaded and been told what to show.
  await page.waitForTimeout(2500);
  const f = await fit(page, frame, ".stage, .ex-frame");
  expect(f.inContainer, `${path}: frame ${f.box} inside its container ${f.container}`).toBe(true);
  expect(f.inView, `${path}: frame ${f.box} inside the window ${f.view}`).toBe(true);
  // Scrolled so the line that introduces it (the home's "Try it", an example's toolbar) is at the top, the device and
  // the controls under it end inside the window (on a phone the controls are a long list: their first row).
  if (f.stageH) {
    await page.locator(".sim-head, .ex-bar").first().evaluate((e) => e.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(300);
    const end = await frame.evaluate((e) => {
      const stage = e.parentElement!.parentElement!, under = stage.children[1] as HTMLElement | undefined;
      const rows = under && stage.clientWidth < 700 && under.firstElementChild ? under.firstElementChild : under;
      return { frame: Math.round(e.getBoundingClientRect().bottom), under: Math.round(rows?.getBoundingClientRect().bottom ?? 0), vh: document.documentElement.clientHeight };
    });
    expect(end.frame, `${path}: the device ends inside the window`).toBeLessThanOrEqual(end.vh);
    expect(end.under, `${path}: the controls under the device end inside the window`).toBeLessThanOrEqual(end.vh);
  }
  if (await page.locator('iframe[title="iPhone Duo, 3D"]').count()) {
    await page.waitForTimeout(1500);
    const edge = await clearOfEdge(page, frame);
    expect(edge.ok, `${path}: the device runs ${edge.worst}px along the frame's edge, to ${edge.at}`).toBe(true);
  }
}

async function cards(page: Page, path: string) {
  const items = page.locator(".exd, .ex-more .loop, .exs .loop");
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    const el = items.nth(i);
    if (!(await el.isVisible())) continue;
    const f = await fit(page, el, ".card, .ex-more > *");
    expect(f.inContainer, `${path}: card media ${i} ${f.box} inside its card ${f.container}`).toBe(true);
    expect(f.inView, `${path}: card media ${i} ${f.box} inside the window ${f.view}`).toBe(true);
  }
}

// One stage at a time per project: four WebGL stages at once starve the GPU.
test.describe.configure({ mode: "default" });

for (const path of ["/", ...EXAMPLES]) {
  test(`devices show whole on ${path}`, async ({ page }, info) => {
    test.setTimeout(300_000);
    const sizes = info.project.name.endsWith("-390") ? [null] : WIDE;
    for (const size of sizes) {
      if (size) await page.setViewportSize({ width: size[0], height: size[1] });
      await test.step(`${size?.join("x") ?? "390x844"}`, async () => {
        await frames(page, path);
        await cards(page, path);
      });
    }
  });
}
