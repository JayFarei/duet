// Records the site's loops (apps/site/app/duo3d/clips.ts) from the real 3D Duo in the iOS simulator's Safari, so the glass
// is iOS's own. Each clip plays once at /duo3d?clip=<name>; the page posts its marks (clip-start, clip-end, every measure)
// to a small server here, which trims the recording to the clip and times its cues. tools/media/compose.sh clip then crops,
// loops and encodes it. Light records on one Duo e2e clone sim and dark on another, at the same time.
//
// Usage: node tools/media/record.mjs [--site http://127.0.0.1:3511] [--light <udid>] [--dark <udid>] [--encode-only] [clip ...]
// Needs the site's build running (next start), ffmpeg, and for the app clips their local mock servers (clips.ts upstream).
// Output goes to .tmp/media/clip (raw recordings and marks in .tmp/media/raw); copy it into apps/site/public/media/clip
// only while no next start serves public/.
import { execFileSync, spawn } from "node:child_process";
import { createServer, request } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const RAW = join(ROOT, ".tmp/media/raw"), OUT = join(ROOT, ".tmp/media/clip");
const COMPOSE = join(ROOT, "tools/media/compose.sh");
const MARKS = 3513, PROXY = 3514; // 3512 is the review server
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args.splice(i, 2)[1]; };
const SITE = opt("--site", "http://127.0.0.1:3511");
const SIMS = { light: opt("--light", "9FCE1601-1100-4AB4-85FF-8A39FD194FDA"), dark: opt("--dark", "F8D31ECD-201C-46FD-A5B6-5EE3B89FF58A") };
const encodeOnly = args.includes("--encode-only");
const pick = args.filter((a) => !a.startsWith("--"));

// The clip list, read from clips.ts so the two never drift: name, posture, steps, length and upstream per clip.
const src = readFileSync(join(ROOT, "apps/site/app/duo3d/clips.ts"), "utf8");
const CLIPS = {};
for (const m of src.matchAll(/^\s+"?([a-z-]+)"?: \{ src: [^\n]*?posture: "(\w+)"[^\n]*?steps: \[(.*?)\], length: (\d+)/gm)) {
  const up = m[0].match(/upstream: "([^"]+)"/)?.[1];
  const turns = [...m[3].matchAll(/at: (\d+), posture: "(\w+)"/g)].map(([, at, p]) => ({ at: +at, posture: p }));
  CLIPS[m[1]] = { posture: m[2], turns, length: +m[4], upstream: up };
}
const names = Object.keys(CLIPS).filter((n) => !pick.length || pick.includes(n));
if (!names.length) throw new Error("no clips match");
// Cards on the home page and the example pages are narrower than the old full-width sections.
const width = (n) => (/^(example|app|mode)-/.test(n) ? 720 : 1080);
mkdirSync(RAW, { recursive: true }); mkdirSync(OUT, { recursive: true });

// Marks: POST /<theme>/<clip> with one JSON mark per request.
const marks = {}, waiters = {};
const markServer = createServer((q, r) => {
  let b = ""; q.on("data", (c) => (b += c));
  q.on("end", () => {
    const key = q.url.slice(1);
    try { const m = JSON.parse(b); (marks[key] ??= []).push(m); if (m.kind === "clip-end") waiters[key]?.(); } catch {}
    r.writeHead(204, { "access-control-allow-origin": "*" }); r.end();
  });
});

// An app clip's origin: the site's /duo3d page and its files, and the app on its mock server for everything else, so the
// Duo's screens (which only talk to their own origin) can show the app. /_next tries the site first, then the app.
function proxy(upstream, port) {
  const fwd = (q, base, body) => new Promise((ok) => {
    const u = new URL(q.url, base);
    const h = { ...q.headers, host: u.host }; delete h["accept-encoding"];
    const out = request(u, { method: q.method, headers: h }, ok);
    out.on("error", () => ok(null)); out.end(body);
  });
  const s = createServer(async (q, r) => {
    const chunks = []; for await (const c of q) chunks.push(c);
    const body = Buffer.concat(chunks);
    const site = /^\/(duo3d|media|_next|favicon)/.test(q.url) && !/^\/duo3d\/web/.test(q.url);
    let res = site ? await fwd(q, SITE, body) : null;
    if (!res || (res.statusCode === 404 && q.url.startsWith("/_next"))) { res?.resume(); res = await fwd(q, upstream, body); }
    if (!res) { r.writeHead(502); return r.end(); }
    r.writeHead(res.statusCode, res.headers); res.pipe(r);
  });
  return new Promise((ok) => s.listen(port, "127.0.0.1", () => ok(s)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const simctl = (...a) => execFileSync("xcrun", ["simctl", ...a], { stdio: "pipe" }).toString();

async function record(theme, name) {
  const udid = SIMS[theme], c = CLIPS[name], key = `${theme}/${name}`;
  const raw = join(RAW, `${name}-${theme}.mp4`);
  let origin = SITE, server;
  if (c.upstream) {
    const ok = await fetch(c.upstream, { signal: AbortSignal.timeout(4000) }).then((r) => r.ok).catch(() => false);
    if (!ok) { console.log(`${key}: ${c.upstream} does not answer, skipped`); return false; }
    const port = PROXY + Object.keys(CLIPS).filter((n) => CLIPS[n].upstream).indexOf(name) * 2 + (theme === "dark" ? 1 : 0);
    server = await proxy(c.upstream, port); origin = `http://127.0.0.1:${port}`;
  }
  const url = `${origin}/duo3d?clip=${name}&theme=${theme}&chrome=0&mark=${encodeURIComponent(`http://127.0.0.1:${MARKS}/${key}`)}`;
  // An app's first load paints blank for a second or two while its bundles arrive, so play app clips once unrecorded to warm the cache.
  if (c.upstream) {
    simctl("openurl", udid, url);
    await Promise.race([new Promise((ok) => (waiters[key] = ok)), sleep(45000)]);
  }
  marks[key] = [];
  const rec = spawn("xcrun", ["simctl", "io", udid, "recordVideo", "--codec", "h264", "--force", raw]);
  const started = await new Promise((ok, no) => {
    const on = (d) => { if (/Recording started/.test(d)) ok(Date.now()); };
    rec.stdout.on("data", on); rec.stderr.on("data", on); rec.on("exit", () => no(new Error(`${key}: recordVideo exited`)));
  });
  simctl("openurl", udid, url);
  const done = await Promise.race([new Promise((ok) => (waiters[key] = () => ok(true))), sleep(45000).then(() => false)]);
  await sleep(600);
  rec.kill("SIGINT");
  await new Promise((ok) => rec.on("exit", ok));
  server?.close();
  if (!done) { console.log(`${key}: no clip-end mark, skipped`); return false; }
  writeFileSync(join(RAW, `${name}-${theme}.json`), JSON.stringify({ started, marks: marks[key] }, null, 1));
  return true;
}

// The cues: what Duet measured on the display in view (closed and sideways show the outer display, open and laptop the
// inner one), on the looped clip's own clock. The loop drops the first F seconds and restarts with a hard cut.
const F = 0.5;
function cues(name, theme) {
  const { marks: ms } = JSON.parse(readFileSync(join(RAW, `${name}-${theme}.json`), "utf8"));
  const start = ms.find((m) => m.kind === "clip-start").at, end = ms.find((m) => m.kind === "clip-end").at;
  const c = CLIPS[name], D = (end - start) / 1000, L = D - F;
  const posture = (s) => c.turns.filter((t) => t.at / 1000 <= s).at(-1)?.posture ?? c.posture;
  const shown = (s) => (["closed", "sideways"].includes(posture(s)) ? "outer" : "inner");
  const state = (s) => ms.filter((m) => m.kind === "measure" && m.display === shown(s) && (m.at - start) / 1000 <= s).at(-1);
  const at = [F, ...ms.filter((m) => m.kind === "measure").map((m) => (m.at - start) / 1000), ...c.turns.map((t) => t.at / 1000)].filter((s) => s >= 0 && s <= D);
  const list = [];
  for (const s of [...new Set(at)].sort((a, b) => a - b)) {
    const m = state(s); if (!m) continue;
    if (s < F) continue;
    const t = Math.min(s - F, L - 0.05);
    list.push({ t: +Math.max(0, t).toFixed(2), fit: m.fit ?? null, length: Math.round(m.length ?? 0), free: Math.round(m.free ?? 0) });
  }
  list.sort((a, b) => a.t - b.t);
  const out = list.filter((x, i) => i === 0 || x.fit !== list[i - 1].fit || x.free !== list[i - 1].free || x.length !== list[i - 1].length);
  return { clip: name, theme, duration: +L.toFixed(2), cues: out.length ? out : [{ t: 0, fit: null, length: 0, free: 0 }] };
}

// The crop: one size for every clip so the device is the same size in each, 4:3, centred on everything that differs from
// the page's background over the clip, inside the page's own area (Safari's buttons, clock and address bar sit outside it).
const CROP_W = 1440, CROP_H = 1080;
function crop(raw, t0, t1) {
  const [W, H] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", raw]).toString().trim().split(",").map(Number);
  const s = 4, w = W / s | 0, h = H / s | 0;
  const buf = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t0), "-to", String(t1), "-i", raw, "-vf", `fps=4,scale=${w}:${h},format=rgb24`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });
  const n = buf.length / (w * h * 3) | 0, px = (f, x, y) => (f * w * h + y * w + x) * 3;
  const bg = [0, 1, 2].map((k) => buf[px(0, (0.4 * w) | 0, (0.09 * h) | 0) + k]);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let f = 0; f < n; f++) for (let y = (0.075 * h) | 0; y < 0.865 * h; y++) for (let x = 0; x < 0.84 * w; x++) {
    const i = px(f, x, y);
    if (Math.abs(buf[i] - bg[0]) + Math.abs(buf[i + 1] - bg[1]) + Math.abs(buf[i + 2] - bg[2]) > 30) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  const cx = ((x0 + x1) / 2) * s, cy = ((y0 + y1) / 2) * s;
  const cw = Math.max(CROP_W, (x1 - x0) * s + 60), ch = Math.max(CROP_H, (y1 - y0) * s + 60, cw * 3 / 4), cw2 = Math.round(ch * 4 / 3);
  const even = (v) => Math.round(v / 2) * 2;
  return { crop: `${even(cw2)}:${even(ch)}:${even(cx - cw2 / 2)}:${even(cy - ch / 2)}`, bg: bg.map((v) => v.toString(16).padStart(2, "0")).join("") };
}

function encode(name, theme) {
  const { started, marks: ms } = JSON.parse(readFileSync(join(RAW, `${name}-${theme}.json`), "utf8"));
  const t0 = (ms.find((m) => m.kind === "clip-start").at - started) / 1000, t1 = (ms.find((m) => m.kind === "clip-end").at - started) / 1000;
  const raw = join(RAW, `${name}-${theme}.mp4`), { crop: c, bg } = crop(raw, t0, t1);
  execFileSync("bash", [COMPOSE, "clip", raw, t0.toFixed(3), t1.toFixed(3), String(width(name)), join(OUT, `${name}-${theme}`), c, bg], { stdio: "inherit" });
  writeFileSync(join(OUT, `${name}-${theme}.cues.json`), JSON.stringify(cues(name, theme)) + "\n");
}

if (!encodeOnly) {
  await new Promise((ok) => markServer.listen(MARKS, "127.0.0.1", ok));
  for (const [theme, udid] of Object.entries(SIMS)) {
    if (!simctl("list", "devices").includes(`${udid}) (Booted)`)) { simctl("boot", udid); await sleep(20000); }
    simctl("ui", udid, "appearance", theme);
  }
  await Promise.all(Object.keys(SIMS).map(async (theme) => {
    for (const n of names) {
      for (let i = 0; i < 2; i++) if (await record(theme, n)) { console.log(`${theme}/${n} recorded`); break; }
    }
  }));
  markServer.close();
}
for (const n of names) for (const theme of Object.keys(SIMS)) {
  if (!existsSync(join(RAW, `${n}-${theme}.json`))) { console.log(`${theme}/${n}: no recording`); continue; }
  encode(n, theme);
}
