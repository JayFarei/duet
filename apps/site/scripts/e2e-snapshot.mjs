#!/usr/bin/env node
// Snapshot of an e2e matrix report (tools/e2e) for the /testing page: public/e2e/summary.json plus small films.
//
//   node apps/site/scripts/e2e-snapshot.mjs --report <matrix dir> [--pair j27-02 --before <dir> --after <dir>]
//                                          [--readme README.md] [--commit <sha>] [--label "rc.1"] [--notes <json>]
//
// --report: the matrix (counts, the state grid, one film per cell, edge case films).
// --pair: one step shown red in --before (default --report) and green in --after, replayed against its samples.
// --notes: step id -> why it is not PASS, checked by a person (default scripts/e2e-notes.json). The judge's own reason
// says what the confirm pass saw; a note says what is known since, and the page shows it first.
// Needs ffmpeg and ffprobe. Reads report dirs only; rewrites apps/site/public/e2e.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, "..");
const ROOT = path.resolve(SITE, "../..");
const OUT = path.join(SITE, "public/e2e");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const REPORT = arg("report");
if (!REPORT) {
  console.error("usage: e2e-snapshot.mjs --report <matrix dir> [--pair <step> --before <dir> --after <dir>] [--readme <md>] [--commit <sha>]");
  process.exit(2);
}
const PAIR = arg("pair", "j27-02");
const BEFORE = arg("before", REPORT);
const AFTER = arg("after");
const README = arg("readme", path.join(ROOT, "README.md"));
const NOTES = arg("notes", path.join(HERE, "e2e-notes.json"));

const sh = (cmd, ...a) => execFileSync(cmd, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// ---- a report dir: merged results plus where each step's files live ------------------------------------------
function load(dir) {
  const res = readJSON(path.join(dir, "results.json"));
  const steps = new Map(); // id -> dir holding steps/<id>.json and shots/<id>.mp4 (a shard, or the report itself)
  const subs = fs.readdirSync(dir).filter((d) => /^shard-\d+$/.test(d)).map((d) => path.join(dir, d));
  for (const d of [dir, ...subs]) {
    const sd = path.join(d, "steps");
    if (!fs.existsSync(sd)) continue;
    for (const f of fs.readdirSync(sd)) if (f.endsWith(".json")) steps.set(f.slice(0, -5), d);
  }
  return { dir, ...res, steps, byId: new Map(res.results.map((r) => [r.id, r])) };
}

// ---- film -------------------------------------------------------------------------------------------------
// simctl recordVideo is variable frame rate and not wall-clock aligned: the step's change is the first burst of
// motion, 5 frames within 0.5s (tools/e2e/e2e.py motion_onset).
function onset(mp4) {
  const ts = sh("ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "frame=pts_time", "-of", "csv=p=0", mp4)
    .split(/\s+/).map((x) => parseFloat(x.replace(",", ""))).filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
  for (let i = 1; i < ts.length - 4; i++) if (ts[i + 4] - ts[i] <= 0.5) return ts[i];
  return null;
}
function duration(mp4) {
  return parseFloat(sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4));
}

// simctl films the display's own pixels, and how the picture sits in them depends on the window and the turn, so the
// film is turned to match the step's screenshot, which simctl writes upright: the turn whose last frame differs least.
const TURNS = { 0: [], 90: ["transpose=1"], 180: ["hflip", "vflip"], 270: ["transpose=2"] };
const gray = (args, vf) => execFileSync("ffmpeg", ["-loglevel", "error", ...args, "-frames:v", "1", "-vf", [...vf, "scale=24:24", "format=gray"].join(","), "-f", "rawvideo", "-"]);
function upright(mp4, png) {
  if (!png || !fs.existsSync(png)) return 0;
  const want = gray(["-i", png], []);
  let best = [Infinity, 0];
  for (const [turn, vf] of Object.entries(TURNS)) {
    const got = gray(["-noautorotate", "-sseof", "-0.2", "-i", mp4], vf);
    let d = 0;
    for (let i = 0; i < want.length; i++) d += Math.abs(want[i] - got[i]);
    if (d < best[0]) best = [d, +turn];
  }
  return best[1];
}

// The window around the change, upright, re-encoded small. Returns the clip's own onset (s) and size.
function clip(mp4, out, { width, before = 1.2, after = 3.6, gop = 60 }) {
  const o = onset(mp4);
  const dur = duration(mp4);
  const ss = o == null ? Math.max(0, dur - after) : Math.max(0, o - before);
  const t = o == null ? after : before + after;
  // simctl writes a frame only when the screen changes, so the film is decoded from its start and resampled to 30fps
  // before the window is cut: the frame on screen when the window opens is held, and the clip's clock starts at 0.
  // The tag simctl writes would turn the film again in every player, so it is dropped.
  const vf = ["sidedata=mode=delete:type=DISPLAYMATRIX", "fps=30", `trim=start=${ss.toFixed(3)}:duration=${t.toFixed(3)}`, "setpts=PTS-STARTPTS",
    ...TURNS[upright(mp4, mp4.replace(/\.mp4$/, ".png"))], `scale=${width}:-2`].join(",");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  sh("ffmpeg", "-loglevel", "error", "-y", "-noautorotate", "-i", mp4, "-vf", vf, "-g", String(gop),
    "-c:v", "libx264", "-crf", "30", "-preset", "slow", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", out);
  sh("ffmpeg", "-loglevel", "error", "-y", "-sseof", "-0.1", "-i", out, "-frames:v", "1", "-q:v", "5", out.replace(/\.mp4$/, ".jpg"));
  return { onset: o == null ? null : +(o - ss).toFixed(3), bytes: fs.statSync(out).size };
}

// ---- geometry (tools/e2e/e2e.py origin, origin_open, frame) ----------------------------------------------
const closedSig = (g) => Math.min(g.outerWidth, g.outerHeight) <= 467 && Math.max(g.outerWidth, g.outerHeight) <= 679;
const isSplit = (g) => g.outerWidth === 469 && g.outerHeight === 669;

function origin(r, kind) {
  const g = r.sig;
  const W = [90, 270].includes(g.angle) ? Math.max(g.screenWidth, g.screenHeight) : Math.min(g.screenWidth, g.screenHeight);
  const H = W === g.screenWidth ? g.screenHeight : g.screenWidth;
  const col = g.angle === 90 ? g.outerWidth - g.innerWidth : 0;
  const vx = r.vv?.x ?? 0;
  if (kind === "preview") return [(W - g.outerWidth) / 2 + col + vx, H - g.innerHeight];
  const top = g.outerWidth === g.innerWidth ? g.outerHeight - g.innerHeight : 0;
  return [col + vx, top];
}
function originOpen(r, kind, native) {
  const g = r.sig;
  const back = (native || []).find((e) => e.label === "Back");
  if (isSplit(g)) {
    const pane = back && back.x > g.outerWidth / 2 ? "right" : "left";
    return [pane === "left" ? g.outerWidth - g.innerWidth : 0, 0];
  }
  if (kind === "preview") {
    const W = g.outerHeight > 700 ? 669 : 951;
    const low = back && back.y > g.outerHeight / 2;
    return [g.outerWidth < W ? (W - g.outerWidth) / 2 : 0, low ? back.y - g.innerHeight : g.outerHeight - g.innerHeight];
  }
  return [back && back.x < 60 && g.outerWidth > g.innerWidth ? g.outerWidth - g.innerWidth : 0,
    g.outerWidth === g.innerWidth ? g.outerHeight - g.innerHeight : 0];
}
const sigKey = (g) => [g.angle, g.innerWidth, g.innerHeight, g.outerWidth, g.outerHeight].join(",");

// Every sample around the change: time from the change (ms), the controls in screen points, and whether the judge
// called it a flash. Only samples on the filmed screen (the step's final posture) get rects.
function timeline(res, step) {
  const S = step.samples.filter((r) => r.visible !== "hidden");
  if (!S.length) return null;
  const prevKey = res.prev?.key?.join(",");
  const first = S.find((r) => prevKey && sigKey(r.sig) !== prevKey) ?? S[0];
  const t0 = first.rx - res.t.change; // the harness's step start, in the beacon's clock
  const flashes = res.reasons.map((x) => x.match(/flash: \S+ shown for (\d+)ms at \+(\d+)ms/)).filter(Boolean)
    .map((m) => [t0 + +m[2], t0 + +m[2] + +m[1]]);
  const opened = res.position === "open";
  const fa = res.final?.angle;
  const rows = [];
  for (const r of S) {
    const t = r.rx - t0 - res.t.change;
    if (t < -900 || t > 3300) continue;
    const nav = (r.navs || []).find((n) => !n.hidden && n.slots?.length);
    const flash = flashes.some(([a, b]) => r.rx >= a && r.rx < b);
    const onFilm = opened ? !closedSig(r.sig) : closedSig(r.sig) && r.sig.angle === fa;
    let rects = [];
    if (nav && onFilm) {
      const [x0, y0] = opened ? originOpen(r, res.kind, res.native) : origin(r, res.kind);
      rects = nav.slots.map((s) => [s.slot, +(s.rect.x + x0).toFixed(1), +(s.rect.y + y0).toFixed(1), +s.rect.w.toFixed(1), +s.rect.h.toFixed(1)]);
    }
    const hidden = (r.navs || []).find((n) => n.hidden)?.hidden ?? null;
    rows.push({ t: Math.round(t), place: nav ? `${nav.mode}/${nav.side}` : null, hidden, flash, screen: closedSig(r.sig) ? "closed" : "open", rects });
  }
  // The filmed screen in points, upright (frame(): the closed screen turns with the phone).
  const turned = !opened && [90, 270].includes(fa);
  const box = opened ? (res.final?.outer === "951x669" ? [951, 669] : [669, 951]) : turned ? [678, 466] : [466, 678];
  return { rows, box };
}

// ---- the state grid ---------------------------------------------------------------------------------------
const SURFACES = [["tab", "Safari tab"], ["sheet", "Preview, sheet"], ["default", "Preview, default"], ["full", "Preview, full screen"], ["over", "Preview, over full screen"]];
const SCREENS = [["closed", "Closed"], ["open", "Open"]];
const ANGLES = [0, 90, 270];
const LIVE = [[false, "No Live Activity"], [true, "Live Activity"]];
const TRANSITIONS = [
  ["open", "Open the page", /^Open /],
  ["turn", "Turn", /^Turn /],
  ["fold", "Fold", /^Fold/],
  ["unfold", "Unfold", /^Unfold/],
  ["live", "Live Activity starts or ends", /music|timer|Live Activity/i],
  ["keyboard", "Keyboard", /keyboard|text field/],
  ["dialog", "Page dialog", /dialog|Duet's "Close"/],
  ["history", "Back, forward, bfcache", /Back|Forward|back "|Reload/],
  ["scroll", "Scroll", /^Scroll/],
  ["system", "Home, lock, app switcher", /Home|Lock|app switcher/],
  ["tap", "Tap, call to action", /^Tap /],
];
const transition = (desc) => TRANSITIONS.find(([, , re]) => re.test(desc))?.[0] ?? "tap";
const RANK = { FAIL: 3, BLOCKED: 2, UNVERIFIED: 2, PASS: 1 };

// ---- README edge cases ------------------------------------------------------------------------------------
// Each "### title" with its "- **You see:** ..." bullets. Links keep their text; issue numbers are collected.
function edgeCases(md) {
  const sec = md.split(/^## Edge cases\s*$/m)[1]?.split(/^## /m)[0];
  if (!sec) return [];
  return sec.split(/^### /m).slice(1).map((b) => {
    const [title, ...lines] = b.split("\n");
    const field = (k) => {
      const l = lines.find((x) => x.startsWith(`- **${k}:**`));
      return l ? l.slice(`- **${k}:**`.length).trim().replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") : null;
    };
    const status = field("Status") ?? "";
    return { title: title.trim(), see: field("You see"), cause: field("Cause"), does: field("Duet does"), you: field("You do"),
      issues: [...new Set([...status.matchAll(/#(\d+)/g)].map((m) => +m[1]))], status };
  });
}
// Edge case -> the step whose film shows it (first PASS match in --report, else any).
const on = (re, screen) => (r) => re.test(r.desc) && (!screen || r.state?.[1] === screen);
const EDGE_FILMS = [
  [/^Turning or folding/, on(/^Unfold/)],
  [/^Text field focus/, on(/text field/)],
  [/^Live Activities and the top band/, on(/Start music/)],
  [/^In-app preview sheet/, on(/in-app preview, sheet style/)],
  [/^In-app preview filling the open screen/, on(/in-app preview, default style/, "open")],
  [/^Full-screen `position: fixed`/, on(/full-screen dialog/)],
  [/^Page dialog open through a turn/, (r) => r.id === "mod01-03"],
  [/^Back\/forward cache/, on(/Tap Safari's Back/)],
  [/^Safari's forward button/, on(/Swipe in from the right edge/)],
  [/^Split view pane, or the closed Duo turned left/, on(/landscape right \(90\)/)],
  [/^Call to action in a closed Safari tab/, on(/Tap Duet's call to action/, "closed")],
];

// ---- main -------------------------------------------------------------------------------------------------
const run = load(REPORT);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

function started(dir) {
  const m = path.basename(/matrix-/.test(dir) ? dir : path.dirname(dir)).match(/(\d{8})-(\d{6})/);
  return m ? `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6)}T${m[2].slice(0, 2)}:${m[2].slice(2, 4)}:00Z`
    : fs.statSync(path.join(dir, "results.json")).mtime.toISOString();
}
// The commit the report's checkout was on when the run started.
function commitOf(dir) {
  try { return sh("git", "-C", dir, "log", "-1", `--before=${started(dir)}`, "--format=%h").trim() || null; } catch { return null; }
}
const date = started(REPORT);
const commit = arg("commit") ?? commitOf(REPORT);
let branch = null;
try { branch = sh("git", "-C", REPORT, "rev-parse", "--abbrev-ref", "HEAD").trim(); } catch { /* not in a checkout */ }

const R = run.results;
const count = (xs, k) => xs.filter((x) => x.status === k).length;
const filmed = (id) => path.join(run.steps.get(id) ?? run.dir, "shots", `${id}.mp4`);
let bytes = 0;

// Cells: worst step first, one film each.
const cells = [];
for (const [surface] of SURFACES) for (const [screen] of SCREENS) for (const angle of ANGLES) for (const [live] of LIVE) {
  const xs = R.filter((r) => r.state && r.state[0] === surface && r.state[1] === screen && r.state[2] === angle && !!r.state[3] === live);
  if (!xs.length) continue;
  const rep = [...xs].sort((a, b) => (RANK[b.status] ?? 0) - (RANK[a.status] ?? 0) || (a.desc.startsWith("Open") ? 1 : 0) - (b.desc.startsWith("Open") ? 1 : 0))[0];
  const mp4 = filmed(rep.id);
  let film = null;
  if (fs.existsSync(mp4)) {
    const c = clip(mp4, path.join(OUT, "cells", `${rep.id}.mp4`), { width: 220 });
    bytes += c.bytes;
    film = `/e2e/cells/${rep.id}.mp4`;
  }
  cells.push({ surface, screen, angle, live, pass: count(xs, "PASS"), fail: count(xs, "FAIL"), unverified: count(xs, "UNVERIFIED") + count(xs, "BLOCKED"),
    steps: xs.map((r) => r.id), rep: rep.id, film });
}

const journeys = new Map(run.journeys.map((j) => [j.id, j.title]));
const notes = fs.existsSync(NOTES) ? readJSON(NOTES) : {};
for (const id of Object.keys(notes)) {
  if (run.byId.get(id)?.status === "PASS" || !run.byId.has(id)) console.warn(`note for ${id} skipped: not a red step in this run`);
}
for (const r of R) if (r.status !== "PASS" && !notes[r.id]) console.warn(`${r.id} is ${r.status} with no note`);
const steps = Object.fromEntries(R.map((r) => [r.id, {
  d: r.desc, s: r.status, why: r.reasons, expect: r.expect_en ?? null, j: r.journey ?? null, tr: transition(r.desc),
  ms: r.samples_n ?? 0, note: r.status !== "PASS" ? notes[r.id] ?? null : null,
}]));

const transitions = TRANSITIONS.map(([k, label]) => {
  const xs = R.filter((r) => transition(r.desc) === k);
  return { key: k, label, steps: xs.length, pass: count(xs, "PASS"), fail: count(xs, "FAIL"), unverified: count(xs, "UNVERIFIED") + count(xs, "BLOCKED") };
});
const pairs = new Set(R.filter((r) => r.state).map((r) => `${r.state.join("/")}|${transition(r.desc)}`)).size;

// Confirm pass: which reds re-ran alone, and what they became.
let confirm = null;
const cf = path.join(REPORT, "confirm", "results.json");
if (fs.existsSync(cf)) {
  const c = readJSON(cf).results;
  confirm = { rerun: c.length, journeys: new Set(c.map((r) => r.journey ?? r.id.split("-")[0])).size };
}

// The pair: the same step red in --before, green in --after, each with its samples.
let pair = null;
if (AFTER) {
  const side = (dir, name) => {
    const rr = dir === REPORT ? run : load(dir);
    const res = rr.byId.get(PAIR);
    const d = rr.steps.get(PAIR);
    if (!res || !d) throw new Error(`${PAIR} not in ${dir}`);
    const tl = timeline(res, readJSON(path.join(d, "steps", `${PAIR}.json`)));
    const c = clip(path.join(d, "shots", `${PAIR}.mp4`), path.join(OUT, "pair", `${name}.mp4`), { width: 480, gop: 6 });
    bytes += c.bytes;
    return { run: path.basename(dir === REPORT || /matrix-/.test(dir) ? dir : path.dirname(dir)), commit: dir === REPORT ? commit : commitOf(dir),
      status: res.status, reasons: res.reasons,
      expect: res.expect_en, film: `/e2e/pair/${name}.mp4`, onset: c.onset, change: res.t.change, final: res.t.final, sampleMs: res.sample_ms, ...tl };
  };
  const b = run.byId.get(PAIR);
  pair = { id: PAIR, desc: b?.desc, journey: journeys.get(b?.journey) ?? null, before: side(BEFORE, "before"), after: side(AFTER, "after") };
}

// Edge cases with a film where the matrix has one.
const edges = fs.existsSync(README) ? edgeCases(fs.readFileSync(README, "utf8")) : [];
for (const e of edges) {
  const m = EDGE_FILMS.find(([re]) => re.test(e.title));
  if (!m) continue;
  const xs = R.filter(m[1]);
  const s = xs.find((r) => r.status === "PASS") ?? xs[0];
  if (!s || !fs.existsSync(filmed(s.id))) continue;
  const c = clip(filmed(s.id), path.join(OUT, "edges", `${s.id}.mp4`), { width: 300 });
  bytes += c.bytes;
  e.film = `/e2e/edges/${s.id}.mp4`;
  e.step = s.id;
}

const summary = {
  run: {
    id: path.basename(REPORT), date, commit: commit || null, branch, label: arg("label", null),
    journeys: run.journeys.length, steps: R.length, frames: R.reduce((a, r) => a + (r.samples_n ?? 0), 0),
    sampleMs: (() => { const xs = R.map((r) => r.sample_ms).filter(Boolean).sort((a, b) => a - b); return xs[xs.length >> 1] ?? null; })(),
    pass: count(R, "PASS"), fail: count(R, "FAIL"), unverified: count(R, "UNVERIFIED") + count(R, "BLOCKED"),
    journeysPass: count(run.journeys, "PASS"), journeysFail: count(run.journeys, "FAIL"), journeysUnverified: count(run.journeys, "UNVERIFIED"),
    confirm,
  },
  dims: { surfaces: SURFACES, screens: SCREENS, angles: ANGLES, live: LIVE },
  cells, steps, journeys: Object.fromEntries(journeys), transitions, pairs, pair, edges,
};
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary));
const total = bytes + fs.statSync(path.join(OUT, "summary.json")).size;
console.log(`${R.length} steps, ${cells.length} cells, ${edges.filter((e) => e.film).length} edge films, ${(total / 1e6).toFixed(2)}MB (+ posters) in ${path.relative(ROOT, OUT)}`);
