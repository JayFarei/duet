#!/usr/bin/env node
// Every /media file the built site references loads, with the right type (PLAN 1b). Next serves only the files in
// public/ at boot, so media written after a build 404s; this runs after `next build` (apps/site `build:site`).
//
// Crawls every static page route in the build's app-path-routes-manifest.json, collects each src, poster, srcset and
// <source> under /media, plus every /media path and clip name in app/clips.ts, requests each and fails on a status
// other than 200 or a wrong content type.
//
//   node tools/media/check-media.mjs                 starts `next start` on 127.0.0.1:3519 from the build, stops it after
//   node tools/media/check-media.mjs --base <url>    checks a server already running
//
// NEXT_DIST_DIR picks the build folder (default .next), as in apps/site/next.config.ts.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "../../apps/site");
const DIST = join(SITE, process.env.NEXT_DIST_DIR || ".next");
const PORT = 3519;
const TYPES = { mp4: "video/mp4", webp: "image/webp", json: "application/json", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
const THEMES = ["light", "dark"];
const CLIP_FILES = ["mp4", "webp", "cues.json"];

const arg = process.argv.indexOf("--base");
let base = arg > 0 ? process.argv[arg + 1]?.replace(/\/$/, "") : undefined;

/** Static page routes from the build: no API or metadata routes, no dynamic segments, no internal pages. */
function routes() {
  const file = join(DIST, "app-path-routes-manifest.json");
  if (!existsSync(file)) throw new Error(`no build at ${DIST}: run next build first`);
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  return Object.entries(manifest)
    .filter(([src, route]) => src.endsWith("/page") && !route.includes("[") && !route.split("/").some((s) => s.startsWith("_")))
    .map(([, route]) => route)
    .sort();
}

/** /media paths and clip names written in app/clips.ts, the list the tour and the recorder share. */
function clipPaths() {
  const file = join(SITE, "app/clips.ts");
  if (!existsSync(file)) return [];
  const src = readFileSync(file, "utf8");
  const literal = [...src.matchAll(/["'`](\/media\/[^"'`$\s]+)["'`]/g)].map((m) => m[1]);
  const names = [...src.matchAll(/\bname:\s*["']([a-z0-9-]+)["']/g)].map((m) => m[1]);
  return [...literal, ...names.flatMap((n) => THEMES.flatMap((t) => CLIP_FILES.map((x) => `/media/clip/${n}-${t}.${x}`)))];
}

/** /media references in one page's HTML: src, poster, srcset (every candidate) and <source> tags. */
function mediaIn(html) {
  const out = [];
  for (const m of html.matchAll(/\s(?:src|poster|href)=["'](\/media\/[^"']+)["']/g)) out.push(m[1]);
  for (const m of html.matchAll(/\s(?:srcset|srcSet)=["']([^"']+)["']/g)) {
    for (const c of m[1].split(",")) { const u = c.trim().split(/\s+/)[0]; if (u.startsWith("/media/")) out.push(u); }
  }
  return out.map((u) => u.split(/[?#]/)[0]);
}

async function waitFor(url, ms = 30_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`${url} did not come up in ${ms / 1000}s`);
}

let server;
async function main() {
  const pages = routes();
  if (!base) {
    base = `http://127.0.0.1:${PORT}`;
    server = spawn("pnpm", ["exec", "next", "start", "-H", "127.0.0.1", "-p", String(PORT)], { cwd: SITE, env: process.env, stdio: "ignore" });
    await waitFor(`${base}/`);
  }
  const refs = new Map(); // path -> where it was referenced
  for (const p of clipPaths()) refs.set(p, "app/clips.ts");
  const failures = [], skipped = [];
  for (const route of pages) {
    const res = await fetch(base + route);
    if (res.status === 404) { skipped.push(route); continue; } // a dev-only page (lab, mockup...) is not served in production
    if (res.status !== 200) { failures.push(`${route}: page ${res.status}`); continue; }
    for (const m of mediaIn(await res.text())) if (!refs.has(m)) refs.set(m, route);
  }
  for (const [path, from] of [...refs].sort()) {
    const res = await fetch(base + path, { method: "GET" });
    const ext = path.endsWith(".cues.json") ? "json" : path.split(".").pop().toLowerCase();
    const want = TYPES[ext], got = (res.headers.get("content-type") || "").split(";")[0].trim();
    await res.arrayBuffer();
    if (res.status !== 200) failures.push(`${path} (${from}): ${res.status}`);
    else if (want && got !== want) failures.push(`${path} (${from}): ${got || "no content type"}, want ${want}`);
  }
  console.log(`check-media: ${pages.length - skipped.length} pages (${skipped.length} dev only), ${refs.size} media files, ${failures.length} failures`);
  for (const f of failures) console.error(`  ${f}`);
  return failures.length ? 1 : 0;
}

main().then((code) => { server?.kill(); process.exit(code); }, (err) => { console.error(`check-media: ${err.message}`); server?.kill(); process.exit(1); });
