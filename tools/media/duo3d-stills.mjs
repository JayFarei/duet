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
// Moment id on the stage, file name on the site.
const SHOTS = [["fit", "form-tabs"], ["folded", "form-more"], ["burger", "form-menu"]];

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
for (const [moment, name] of SHOTS) {
  await p.evaluate((m) => dispatchEvent(new CustomEvent("duet:moment", { detail: m })), moment);
  await p.waitForTimeout(4500);
  const png = join(TMP, `${name}.png`);
  await p.screenshot({ path: png, omitBackground: true, clip: await frame.boundingBox() });
  execFileSync("magick", [png, "-trim", "+repage", "-bordercolor", "none", "-border", "24", "-resize", "1200x1200>", png]);
  execFileSync("cwebp", ["-quiet", "-q", "86", "-alpha_q", "100", png, "-o", join(OUT, `${name}.webp`)]);
  console.log(name);
}
await b.close();
