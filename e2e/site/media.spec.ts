// T2: every page's media loads and plays only in view (PLAN 1b, 5). Red until the clips and loop tiles land (step 7).
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { CLIPS, GPU, PAGES, scrollThrough } from "./site";

// The pages carry the live stage: drawn in software it starves the main thread, and four workers then miss the timeout.
test.use(GPU);

/** The least peak frame change a clip with a working step shows (calibrated on the recorded set, PROGRESS.md). */
const MOTION = 0.3;
const TYPES: Record<string, string> = { mp4: "video/mp4", webp: "image/webp", json: "application/json" };

for (const path of PAGES) {
  test(`media on ${path}`, async ({ page }) => {
    const bad: string[] = [];
    page.on("response", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/_vercel/")) return;
      if (r.status() >= 400) bad.push(`${r.status()} ${u.pathname}`);
      if (u.pathname.startsWith("/media/")) {
        const ext = u.pathname.endsWith(".cues.json") ? "json" : u.pathname.split(".").pop()!;
        const type = (r.headers()["content-type"] || "").split(";")[0];
        if (r.status() < 300 && TYPES[ext] && type !== TYPES[ext]) bad.push(`${type} ${u.pathname}`);
      }
    });
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await scrollThrough(page, 400);

    const videos = page.locator("video");
    expect(await videos.count(), "the page shows its recorded loops").toBeGreaterThan(0);
    for (let i = 0; i < (await videos.count()); i++) {
      const v = videos.nth(i);
      await v.scrollIntoViewIfNeeded();
      const state = () => v.evaluate((e: HTMLVideoElement) => JSON.stringify({ paused: e.paused, ready: e.readyState, net: e.networkState, t: e.currentTime, played: e.played.length }));
      const why = async (err: Error) => { throw new Error(`${err.message} STATE ${await state()}`); };
      await expect.poll(() => v.evaluate((e: HTMLVideoElement) => e.readyState), { message: `video ${i} loads in view`, timeout: 15000 }).toBeGreaterThanOrEqual(2).catch(why);
      await expect.poll(() => v.evaluate((e: HTMLVideoElement) => !e.paused && e.played.length > 0), { message: `video ${i} plays`, timeout: 15000 }).toBe(true).catch(why);
      const poster = await v.getAttribute("poster");
      expect(poster, `video ${i} has a poster`).toMatch(/^\/media\/clip\/.+\.webp$/);
    }
    // Off screen, every loop is paused.
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(500);
    const playingOff = await page.evaluate(() => [...document.querySelectorAll("video")].filter((v) => {
      const r = v.getBoundingClientRect();
      return (r.bottom < 0 || r.top > innerHeight) && !v.paused;
    }).length);
    expect(playingOff, "videos off screen are paused").toBe(0);

    const posters = await page.evaluate(() => [...document.querySelectorAll("img")].filter((i) => i.src.includes("/media/") && i.complete && i.naturalWidth === 0).map((i) => i.src));
    expect(posters, "every image under /media decodes").toEqual([]);
    expect(bad, "no 4xx/5xx and right media types").toEqual([]);
  });
}

test("every clip on disk is on the clip list, in both themes", async ({ request }) => {
  for (const name of CLIPS) for (const theme of ["light", "dark"]) for (const ext of ["mp4", "webp", "cues.json"]) {
    const r = await request.get(`/media/clip/${name}-${theme}.${ext}`);
    expect(r.status(), `${name}-${theme}.${ext}`).toBe(200);
  }
});

/** The largest change between two frames a quarter second apart, as the mean absolute grey difference (0..255) of a
 *  64 px wide copy. A clip whose steps never fire shows only the idle sway and stays near 0. */
function motion(file: string) {
  const w = 64, h = 48;
  const buf = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `fps=4,scale=${w}:${h},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 64 << 20 });
  const n = Math.floor(buf.length / (w * h));
  let peak = 0;
  for (let f = 1; f < n; f++) {
    let sum = 0;
    for (let i = 0; i < w * h; i++) sum += Math.abs(buf[f * w * h + i] - buf[(f - 1) * w * h + i]);
    peak = Math.max(peak, sum / (w * h));
  }
  return peak;
}

test("every clip shows its steps, not a still device", async ({ browserName }) => {
  test.skip(browserName !== "chromium", "reads files on disk, once is enough");
  const dir = join(__dirname, "../../apps/site/public/media/clip");
  const still: string[] = [];
  for (const name of CLIPS.filter((c) => !c.startsWith("app-"))) for (const theme of ["light", "dark"]) {
    const m = motion(join(dir, `${name}-${theme}.mp4`));
    if (m < MOTION) still.push(`${name}-${theme} ${m.toFixed(2)}`);
  }
  expect(still, "clips with no visible step").toEqual([]);
});
