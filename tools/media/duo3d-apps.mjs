// Renders real apps on the site's 3D Duo to trimmed webps in apps/site/public/media (app-<name>.webp).
// The Duo's screens only take signals from their own origin, so each app and the site's /duo3d pages are served together
// under one made-up origin: /duo3d and /_next go to the site (falling back to the app when the site has no such file), the rest to the app.
// The address bar on the Duo shows <name>.example. Needs the site on 127.0.0.1:3500 and each app running locally on mock data (see docs/feature-map.md).
// Usage: node tools/media/duo3d-apps.mjs [name ...]
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const SITE = "http://127.0.0.1:3500";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../apps/site/public/media");
const TMP = mkdtempSync(join(tmpdir(), "duo3d-apps-"));
// Name, where the app runs, the page to load, the Duo's moment, and what to tap first, in order (a CSS selector, or text= for a button's text).
const APPS = [
  ["regtail", "http://127.0.0.1:8795", "/app", "fit", ["text=See a sample report"]],
  ["dashboard", "http://127.0.0.1:3591", "/", "fit", []],
  ["wealth", "http://127.0.0.1:8292", "/", "burger", ['.duet-btn[aria-label="Menu"]']],
];
const pick = process.argv.slice(2);

const clear = "html,body,main,section,.stage,.duet-scroller{background:transparent!important}";
const b = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
for (const [name, app, src, moment, taps] of APPS.filter(([n]) => !pick.length || pick.includes(n))) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 2, colorScheme: "light" });
  const origin = `https://${name}.example`;
  await p.route(`${origin}/**`, async (r) => {
    const req = r.request(), u = new URL(req.url()), path = `${u.pathname}${u.search}`;
    const init = { method: req.method(), headers: req.headers(), postData: req.postDataBuffer() ?? undefined, maxRedirects: 0 };
    const top = req.isNavigationRequest() && req.frame() === p.mainFrame();
    if (top || /^\/(duo3d|media|_next|favicon)/.test(u.pathname)) {
      const site = await r.fetch({ ...init, url: SITE + path });
      if (site.status() !== 404 || !u.pathname.startsWith("/_next")) return r.fulfill({ response: site });
    }
    r.fulfill({ response: await r.fetch({ ...init, url: app + path }) });
  });
  // The home page's stage, as in duo3d-stills.mjs, with the app loaded on the Duo.
  await p.goto(`${origin}/`);
  const frame = p.locator(".stage iframe").first();
  await frame.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(5000);
  await p.addStyleTag({ content: `${clear} .moments{display:none!important}` });
  await p.evaluate(() => { const bar = document.querySelector(".stage input[type=range]")?.parentElement; if (bar) bar.style.visibility = "hidden"; });
  await (await frame.elementHandle()).contentFrame().then((f) => f.addStyleTag({ content: "html,body{background:transparent!important}" }));
  await p.evaluate(([s, m]) => dispatchEvent(new CustomEvent("duet:example", { detail: { src: s, moment: m } })), [src, moment]);
  await p.waitForTimeout(8000);
  // The page shows on each of the Duo's screens, so the tap goes to every copy of it.
  for (const sel of taps) {
    for (const f of p.frames().filter((f) => new URL(f.url()).pathname === src)) await f.evaluate((s) => (s.startsWith("text=") ? [...document.querySelectorAll("button,a")].find((e) => e.textContent.includes(s.slice(5))) : document.querySelector(s))?.click(), sel);
    await p.waitForTimeout(6000);
  }
  const png = join(TMP, `${name}.png`);
  await p.screenshot({ path: png, omitBackground: true, clip: await frame.boundingBox() });
  execFileSync("magick", [png, "-trim", "+repage", "-bordercolor", "none", "-border", "24", "-resize", "1200x1200>", png]);
  execFileSync("cwebp", ["-quiet", "-q", "86", "-alpha_q", "100", png, "-o", join(OUT, `app-${name}.webp`)]);
  console.log(name, png);
  await p.close();
}
await b.close();
