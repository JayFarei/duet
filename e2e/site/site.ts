// Shared names and probes for the site suite. The names are the glossary (PLAN section 2): one word per thing, the
// same in nav, headings, captions, data-duet-control / data-duet-fit values, test ids and media filenames.
import type { Frame, Page } from "@playwright/test";

/** The nouns, in order: the /components sidebar and its h2s. */
export const NOUNS = ["Group", "Navigation", "More", "Actions", "Primary", "Close", "Pane bar"] as const;
/** data-duet-fit values (Navigation's three forms) and their display names. */
export const FITS = { tabs: "Tabs", "tabs-more": "Tabs + More", sidebar: "Sidebar" } as const;
/** data-duet-control values, one per button kind Duet draws. */
export const CONTROLS = ["navigation", "sidebar", "more", "actions", "primary", "close"] as const;
/** The home tour: caption, anchor id (#tour-<slug>), and what the screen shows at the step's end. */
export const TOUR = [
  { caption: "Places", slug: "places" },
  { caption: "Free space", slug: "free-space" },
  { caption: "Navigation", slug: "navigation", fit: "tabs-more" },
  { caption: "More", slug: "more" },
  { caption: "Actions + Sidebar", slug: "actions", fit: "sidebar" },
  { caption: "Primary", slug: "primary" },
  { caption: "Close, Modes", slug: "close", only: ["close"] },
] as const;
/** Every recorded clip's base name (apps/site/public/media/clip/<name>-<light|dark>.{mp4,webp,cues.json}). */
export const CLIPS = [
  "group", "navigation-tabs", "navigation-tabs-more", "navigation-sidebar", "more", "actions",
  "primary-confirm", "primary-direct", "primary-folded", "close", "pane-bar",
  "mode-strip", "mode-column", "mode-inline", "example-inbox", "example-checkout", "example-reader",
  "app-regtail", "app-dashboard", "app-wealth",
] as const;
export const EXAMPLES = ["/examples/inbox", "/examples/checkout", "/examples/reader"] as const;
/** Every public page of the site. */
export const PAGES = ["/", "/components", ...EXAMPLES] as const;
/** Routes the Duo e2e harness and tools use: kept, never linked from the site. */
export const HARNESS = ["/lab", "/mockup", "/workbench", "/scroll", "/probe", "/column", "/panes", "/book"] as const;
/** Routes that are gone. */
export const GONE = ["/sheet", "/skeleton"] as const;
/** Words retired from every user-facing surface. */
export const BANNED = /\b(burger|main button|call to action|cta|pill|capsule|control strip|this page)\b/i;

/** Scrolls a page top to bottom in viewport steps, giving lazy media and the tour time to react. */
export async function scrollThrough(page: Page, pause = 250) {
  const steps = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight / innerHeight));
  for (let i = 0; i <= steps; i++) {
    await page.evaluate((y) => scrollTo(0, y), i * (await page.evaluate(() => innerHeight)));
    await page.waitForTimeout(pause);
  }
}

/** Mean luminance (0..255, Rec. 709) of each pixel row of a screenshot region, decoded in the page's own canvas. */
export async function rowLuminance(page: Page, clip: { x: number; y: number; width: number; height: number }) {
  const png = (await page.screenshot({ clip, scale: "css" })).toString("base64");
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, rows: number[] = [];
    for (let y = 0; y < c.height; y++) {
      let sum = 0;
      for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; }
      rows.push(sum / c.width);
    }
    return rows;
  }, png);
}

/** The top cap of the first .duet-group in `frame`: the middle 40% of its width, its top 8 rows. */
export async function capLuminance(page: Page, frame: Page | Frame = page) {
  const g = await frame.locator(".duet-group").first().boundingBox();
  if (!g) throw new Error("no .duet-group on screen");
  const rows = await rowLuminance(page, { x: g.x + g.width * 0.3, y: g.y, width: g.width * 0.4, height: 8 });
  const bg = await rowLuminance(page, { x: Math.max(0, g.x - 14), y: g.y + 4, width: 6, height: 8 });
  return { cap: rows.reduce((a, b) => a + b) / rows.length, peak: Math.max(...rows), bg: bg.reduce((a, b) => a + b) / bg.length };
}

/** Every frame running Duet (a nav.duet with a drawn group): the page itself, or the stage's screens. */
export async function duetFrames(page: Page) {
  const out: Frame[] = [];
  for (const f of page.frames()) {
    try { if (await f.locator("nav.duet:not(.duet-sidebar) .duet-group").count()) out.push(f); } catch { /* detached */ }
  }
  return out;
}

/** Navigation's fit and the set of control kinds Duet shows, per frame running Duet. */
export async function duetState(page: Page) {
  const out: { fit: string | null; controls: string[] }[] = [];
  for (const f of await duetFrames(page)) {
    out.push(await f.evaluate(() => {
      const nav = document.querySelector("nav.duet:not(.duet-sidebar)");
      const kinds = [...document.querySelectorAll(".duet-group:not([data-leaving]) [data-duet-control]")].map((e) => e.getAttribute("data-duet-control")!);
      return { fit: nav?.getAttribute("data-duet-fit") ?? null, controls: [...new Set(kinds)].sort() };
    }));
  }
  return out;
}

/** Counts WebGL contexts created in the top frame (install before goto). */
export const COUNT_WEBGL = () => {
  if (window.top !== window) return;
  const seen = new WeakSet<object>();
  (window as unknown as { __webgl: number }).__webgl = 0;
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    const ctx = (orig as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    if (ctx && /^(webgl2?|experimental-webgl)$/.test(type) && !seen.has(ctx)) { seen.add(ctx); (window as unknown as { __webgl: number }).__webgl++; }
    return ctx;
  } as typeof orig;
};
