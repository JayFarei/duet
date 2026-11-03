// Renders the stage's real 3D Duo at each moment to a transparent, trimmed webp in apps/site/public/media.
// Needs the site served on 127.0.0.1 (pnpm build && pnpm start). Usage: node tools/media/duo3d-stills.mjs [port]
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// The address bar shows the host, so the page loads as getduet.dev, answered by the local server.
const PORT = process.argv[2] ?? "3500";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../apps/site/public/media");
const TMP = mkdtempSync(join(tmpdir(), "duo3d-"));
// The event the stage takes, its detail, the file name on the site, and what to tap on the page first (CSS selectors, in order).
const SHOTS = [
  ["duet:moment", "fit", "form-tabs"], ["duet:moment", "folded", "form-more"], ["duet:moment", "burger", "form-menu"],
  // The controls, each caught in use: the sidebar open, the main button's confirmation, a sheet's X in the column.
  ["duet:example", { src: "/skeleton", moment: "burger" }, "control-menu", ['.duet-btn[aria-label="Menu"]']],
  ["duet:example", { src: "/book", moment: "fold" }, "control-main", ['.duet-btn[aria-label="Book"]']],
  ["duet:example", { src: "/sheet", moment: "burger" }, "control-close", ["main button"]],
];

const clear = "html,body,main,section,.stage,.duet-scroller{background:transparent!important}";
const b = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 2, colorScheme: "light" });
await p.route("https://getduet.dev/**", async (r) => {
  const u = new URL(r.request().url());
  r.fulfill({ response: await r.fetch({ url: `http://127.0.0.1:${PORT}${u.pathname}${u.search}` }) });
});
await p.goto("https://getduet.dev/");
const frame = p.locator(".stage iframe").first();
await frame.evaluate((e) => e.scrollIntoView({ block: "center" }));
await p.waitForTimeout(5000);
// Only the device: the page behind it goes transparent, the moment buttons go, and the shot is the frame's box.
await p.addStyleTag({ content: `${clear} .moments{display:none!important}` });
// The undo, redo, unfold and lock bar over the device.
await p.evaluate(() => { const bar = document.querySelector(".stage input[type=range]")?.parentElement; if (bar) bar.style.visibility = "hidden"; });
await (await frame.elementHandle()).contentFrame().then((f) => f.addStyleTag({ content: "html,body{background:transparent!important}" }));
for (const [type, detail, name, taps = []] of SHOTS) {
  await p.evaluate(([t, d]) => dispatchEvent(new CustomEvent(t, { detail: d })), [type, detail]);
  await p.waitForTimeout(4500);
  // The page shows on each of the Duo's screens, so the tap goes to every copy of it.
  for (const sel of taps) {
    for (const f of p.frames().filter((f) => new URL(f.url()).pathname === detail.src)) await f.evaluate((s) => document.querySelector(s)?.click(), sel);
    await p.waitForTimeout(2500);
  }
  const png = join(TMP, `${name}.png`);
  await p.screenshot({ path: png, omitBackground: true, clip: await frame.boundingBox() });
  execFileSync("magick", [png, "-trim", "+repage", "-bordercolor", "none", "-border", "24", "-resize", "1200x1200>", png]);
  execFileSync("cwebp", ["-quiet", "-q", "86", "-alpha_q", "100", png, "-o", join(OUT, `${name}.webp`)]);
  console.log(name);
}
await b.close();
