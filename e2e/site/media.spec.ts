// T2: every page's media loads and plays only in view (PLAN 1b, 5). Red until the clips and loop tiles land (step 7).
import { expect, test } from "@playwright/test";
import { CLIPS, PAGES, scrollThrough } from "./site";

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
      await expect.poll(() => v.evaluate((e: HTMLVideoElement) => e.readyState), { message: `video ${i} loads in view` }).toBeGreaterThanOrEqual(2);
      const t0 = await v.evaluate((e: HTMLVideoElement) => e.currentTime);
      await expect.poll(() => v.evaluate((e: HTMLVideoElement) => e.currentTime), { message: `video ${i} plays` }).toBeGreaterThan(t0);
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
