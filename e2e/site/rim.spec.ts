// Pixel oracle for the glass rim (docs/edge-cases.md "Light rim paints black off iOS", "Black caps on the column
// capsule"): samples a ring just inside every control's border, on the column capsule, an inline group and the open
// "…", in light and dark, and fails where light paints near black (or dark near white) over a page that is not that
// colour. The page under the glass is read 6px outside the border on the same normal. glass.spec.ts checks the top
// cap's mean; this checks every point of the edge, the sides and the corners included.
// DUET_CSS=<file> appends that stylesheet to every Duet frame, after the shipped one, to replay an older duet.css
// (e.g. `git show v0.8.0:packages/duet-ui/src/duet.css`) against the same pages without a rebuild.
import { readFileSync } from "node:fs";
import { expect, test, type Frame, type Page } from "@playwright/test";

const OVERRIDE = process.env.DUET_CSS ? readFileSync(process.env.DUET_CSS, "utf8") : "";
const DARK = 0.15 * 255, WHITE = 0.85 * 255;
const INSETS = [1.5, 4, 8]; // px inside the border: the 1px highlight, the band, the cap's inner glow

interface Box { x: number; y: number; width: number; height: number }
interface Sample { inset: number; x: number; y: number; lum: number; bg: number }

/** Luminance (0..255, Rec. 709) on rings `INSETS` inside a rounded rect, and the page 6px outside on the same normal. */
async function ring(page: Page, box: Box, radius: number): Promise<Sample[]> {
  const vp = page.viewportSize()!, m = 8;
  const clip = { x: Math.max(0, box.x - m), y: Math.max(0, box.y - m), width: 0, height: 0 };
  clip.width = Math.min(vp.width, box.x + box.width + m) - clip.x; clip.height = Math.min(vp.height, box.y + box.height + m) - clip.y;
  const png = (await page.screenshot({ clip, scale: "css", animations: "disabled" })).toString("base64");
  return page.evaluate(async ({ b64, box, clip, radius, insets }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, sx = c.width / clip.width, sy = c.height / clip.height;
    const lum = (x: number, y: number) => {
      const px = Math.min(c.width - 1, Math.max(0, Math.round((x - clip.x) * sx))), py = Math.min(c.height - 1, Math.max(0, Math.round((y - clip.y) * sy)));
      const i = (py * c.width + px) * 4;
      return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    };
    const r = Math.min(radius, box.width / 2, box.height / 2), out: { inset: number; x: number; y: number; lum: number; bg: number }[] = [];
    // Walk the border every 3px: four straight runs and four quarter arcs, each point with its outward normal.
    const pts: [number, number, number, number][] = [];
    const run = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
      const n = Math.max(1, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 3));
      for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, nx, ny]);
    };
    const arc = (cx: number, cy: number, a0: number) => {
      const n = Math.max(2, Math.ceil(r * Math.PI / 2 / 3));
      for (let i = 0; i <= n; i++) { const a = a0 + Math.PI / 2 * i / n, nx = Math.cos(a), ny = Math.sin(a); pts.push([cx + r * nx, cy + r * ny, nx, ny]); }
    };
    const { x, y, width: w, height: h } = box;
    run(x + r, y, x + w - r, y, 0, -1); arc(x + w - r, y + r, -Math.PI / 2);
    run(x + w, y + r, x + w, y + h - r, 1, 0); arc(x + w - r, y + h - r, 0);
    run(x + w - r, y + h, x + r, y + h, 0, 1); arc(x + r, y + h - r, Math.PI / 2);
    run(x, y + h - r, x, y + r, -1, 0); arc(x + r, y + r, Math.PI);
    for (const [px, py, nx, ny] of pts) {
      const bx = px + nx * 6, by = py + ny * 6;
      if (bx < clip.x || by < clip.y || bx > clip.x + clip.width - 1 || by > clip.y + clip.height - 1) continue; // page edge: no page to compare
      const bg = lum(bx, by);
      for (const k of insets) out.push({ inset: k, x: +(px - nx * k).toFixed(1), y: +(py - ny * k).toFixed(1), lum: +lum(px - nx * k, py - ny * k).toFixed(1), bg: +bg.toFixed(1) });
    }
    return out;
  }, { b64: png, box, clip, radius, insets: INSETS });
}

/** The frame running Duet: the page, or /space's iframe. With DUET_CSS, the older stylesheet goes in after the shipped one. */
async function duet(page: Page): Promise<Frame> {
  const f = page.frames().find((x) => x.url().includes("/examples/")) ?? page.mainFrame();
  if (OVERRIDE) await f.evaluate((css) => { const s = document.createElement("style"); s.dataset.override = ""; s.textContent = css; document.head.append(s); }, OVERRIDE);
  return f;
}

/** Every drawn control surface in the frame: groups not leaving, and the open "…". */
async function surfaces(f: Frame) {
  return f.evaluate(() => [...document.querySelectorAll<HTMLElement>("nav.duet .duet-group:not([data-leaving]), .duet-blob")].map((e) => {
    const b = e.getBoundingClientRect();
    return { name: e.classList.contains("duet-blob") ? "open …" : `group ${e.dataset.duetSlot ?? ""}`, r: parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0, b: { x: b.x, y: b.y, width: b.width, height: b.height } };
  }).filter((s) => s.b.width > 0 && s.b.height > 0));
}

async function check(page: Page, f: Frame, scheme: "light" | "dark", what: string) {
  const off = await page.evaluate(() => { const e = document.querySelector("[data-space-clip] iframe"); const b = e?.getBoundingClientRect(); return b ? { x: b.x, y: b.y } : { x: 0, y: 0 }; });
  const list = await surfaces(f);
  expect(list.length, `${what}: a control on screen`).toBeGreaterThan(0);
  await test.info().attach(`${what}-${scheme}.png`, { body: await page.screenshot(), contentType: "image/png" });
  const bad: string[] = [];
  let worst = scheme === "light" ? 255 : 0;
  for (const s of list) {
    const samples = await ring(page, { ...s.b, x: s.b.x + off.x, y: s.b.y + off.y }, s.r);
    for (const p of samples) {
      worst = scheme === "light" ? Math.min(worst, p.lum) : Math.max(worst, p.lum);
      const wrong = scheme === "light" ? p.lum < DARK && p.bg >= DARK : p.lum > WHITE && p.bg <= WHITE;
      if (wrong) bad.push(`${s.name} (${p.x},${p.y}) inset ${p.inset}: ${p.lum} over page ${p.bg}`);
    }
  }
  const head = `${what}, ${scheme}: ${bad.length} edge samples ${scheme === "light" ? "near black" : "near white"} (limit ${(scheme === "light" ? DARK : WHITE).toFixed(0)}), worst ${worst.toFixed(1)}`;
  await test.info().attach(`${what}-${scheme}-samples.txt`, { body: [head, ...bad].join("\n"), contentType: "text/plain" });
  expect(bad, `${head}\n${bad.slice(0, 12).join("\n")}`).toEqual([]);
}

async function settle(f: Frame, page: Page) {
  await f.locator("nav.duet .duet-group").first().waitFor();
  await expect.poll(() => f.evaluate(() => !document.querySelector("nav.duet[data-settling], .duet-group[data-enter]")), { timeout: 10_000 }).toBe(true);
  await page.waitForTimeout(400); // the spring's tail and the backdrop's first paint
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} rim edge`, () => {
    test.use({ colorScheme: scheme });

    test("inline group", async ({ page }) => {
      await page.goto("/examples/inbox?plain");
      const f = await duet(page);
      await settle(f, page);
      await check(page, f, scheme, "inline");
    });

    test("open …", async ({ page }) => {
      await page.goto("/examples/inbox?plain");
      const f = await duet(page);
      await settle(f, page);
      await f.locator('[data-duet-control="more"]').first().click();
      await f.locator(".duet-blob .duet-menu[data-rest]").waitFor({ timeout: 10_000 });
      await page.waitForTimeout(400);
      await check(page, f, scheme, "open-more");
    });

    // The column only exists on the closed Duo: the web Duo's Safari tab at 1:1 (/space), at the scene's own size.
    test("column capsule", async ({ page }) => {
      await page.setViewportSize({ width: 466, height: 678 });
      await page.goto(`/space?s=${encodeURIComponent(JSON.stringify({ posture: "closed", app: "safari", turn: 0 }))}`);
      await page.frameLocator("[data-space-clip] iframe").locator('nav.duet[data-mode="column"]').waitFor({ state: "attached", timeout: 20_000 });
      const f = await duet(page);
      await settle(f, page);
      await check(page, f, scheme, "column");
    });
  });
}
