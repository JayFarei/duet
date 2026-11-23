// The 3D device never zooms: a wheel or a trackpad pinch (a wheel with Control held) over it leaves the device the
// size it was, locked or after Use the device (#279), and a plain wheel over a locked device still scrolls the page.
// Turning and the other device controls stay. The probe: the device's drawn width, the pixels in the frame that differ
// from the frame's background (the median of its edge ring).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { GPU } from "./site";

test.use({ reducedMotion: "reduce", ...GPU }); // no idle sway between the two measures
test.describe.configure({ timeout: 240_000 });
test.skip(({ isMobile }) => isMobile, "a phone has no wheel (mobile WebKit cannot send one)");

const FRAME = 'iframe[title="iPhone Duo, 3D"]';

async function width(page: Page, frame: Locator): Promise<number> {
  const b = (await frame.boundingBox())!;
  const clip = { x: Math.ceil(b.x) + 1, y: Math.max(0, Math.ceil(b.y) + 1), width: Math.floor(b.width) - 2, height: Math.min(Math.floor(b.height) - 2, page.viewportSize()!.height - Math.max(0, Math.ceil(b.y) + 1)) };
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
    const ring: number[] = [];
    for (let x = 0; x < w; x++) ring.push(lum(x, 0), lum(x, h - 1));
    for (let y = 0; y < h; y++) ring.push(lum(0, y), lum(w - 1, y));
    ring.sort((a, b) => a - b);
    const ref = ring[ring.length >> 1];
    // The corners are the card's rounding around the frame, not the device.
    const R = 28, corner = (x: number, y: number) => (x < R || x >= w - R) && (y < R || y >= h - R);
    let lo = w, hi = -1;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x++) if (!corner(x, y) && Math.abs(lum(x, y) - ref) > 24) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
    return hi - lo;
  }, png);
}

/** Wheels over the scene beside the device (the 3D canvas; over the device's screens the wheel goes to the app in
 *  them) and over its middle, plain and as a pinch (Control held), both ways, and returns the widths seen, each with
 *  the page scrolled back to `y`: the wheel may scroll the page, which is fine, but moves the frame. */
async function wheelOver(page: Page, frame: Locator, y: number, spots = [0.06, 0.5]) {
  const seen: number[] = [];
  for (const at of spots) for (const ctrl of [false, true]) for (const dy of [-400, 400]) {
    const b = (await frame.boundingBox())!;
    const top = Math.max(b.y, 0), bottom = Math.min(b.y + b.height, page.viewportSize()!.height);
    await page.mouse.move(b.x + b.width * at, (top + bottom) / 2);
    if (ctrl) await page.keyboard.down("Control");
    for (let i = 0; i < 4; i++) await page.mouse.wheel(0, dy / 4);
    if (ctrl) await page.keyboard.up("Control");
    await page.waitForTimeout(700); // OrbitControls eases a dolly in over a few frames
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(300);
    seen.push(await width(page, frame));
  }
  return seen;
}

async function settle(page: Page, frame: Locator) {
  await frame.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await expect.poll(() => page.evaluate(() => (window as unknown as { __duoFrames?: number }).__duoFrames ?? 0), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(2500); // the model loads and the camera settles
}

for (const path of ["/", "/examples/inbox"]) {
  test.describe(path, () => {
    test.skip(({ viewport }) => path !== "/" && (viewport?.width ?? 0) < 768, "at 390 the block shows its recorded loop, not the stage");

    test("the wheel and a pinch never zoom the device, locked or in use", async ({ page }) => {
      await page.goto(path);
      const frame = page.locator(FRAME).first();
      await settle(page, frame);
      const w0 = await width(page, frame);
      expect(w0, "the device is drawn").toBeGreaterThan(60);

      // Locked: the page takes the wheel (the shield lies over the whole frame, so one spot will do).
      const locked = await page.evaluate(() => scrollY);
      for (const w of await wheelOver(page, frame, locked, [0.06])) expect(Math.abs(w - w0), `locked, ${w} vs ${w0}`).toBeLessThanOrEqual(3);

      // In use: the device takes the pointer, yet neither wheel nor pinch changes its size.
      const use = path === "/" ? page.getByRole("button", { name: "Unlock to drag the device" }) : page.getByRole("button", { name: "Use the device" });
      await use.click();
      await page.evaluate((y) => scrollTo(0, y), locked);
      await page.waitForTimeout(500);
      const w1 = await width(page, frame);
      for (const w of await wheelOver(page, frame, locked)) expect(Math.abs(w - w1), `in use, ${w} vs ${w1}`).toBeLessThanOrEqual(3);
    });
  });
}

test("a plain wheel over the locked device scrolls the page", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768, "at 390 the block shows its recorded loop, not the stage");
  await page.goto("/examples/inbox");
  const frame = page.locator(FRAME).first();
  await settle(page, frame);
  const b = (await frame.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, Math.max(b.y, 0) + 100);
  const y0 = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y0 + 100);
});
