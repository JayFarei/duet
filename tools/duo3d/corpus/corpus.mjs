// The "With Duet" preview over a corpus of real sites: what the shell reads off each header, what the decision model
// makes of it, and what Duet ends up showing, in Chromium, Playwright's WebKit and real Safari (safaridriver).
// Needs the site's dev server with TYPESAFE_KEY (see tools/duo3d/setup.sh).
//
//   node tools/duo3d/corpus/corpus.mjs [--engines chromium,webkit,safari] [--base http://localhost:3167] [--only farei] [--out dir]
//
// Writes <out>/report.json, report.md and a screenshot per site and engine; exits 1 when a site fails a check.
import { chromium, webkit } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { safari } from "./safari.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const base = arg("base", "http://localhost:3167");
const engines = arg("engines", "chromium,webkit,safari").split(",");
const out = arg("out", join(here, "out"));
const only = arg("only");
const sites = JSON.parse(readFileSync(join(here, "sites.json"), "utf8")).filter((s) => !only || s.url.includes(only));
const SIZE = { width: 400, height: 820 };
mkdirSync(out, { recursive: true });

// Runs in the page: the shell's result plus what Duet shows, button by button.
function inspect() {
  const r = window.__duo3d;
  if (!r) return null;
  const btns = [...document.querySelectorAll("#duo3d-duet button, #duo3d-duet [role=tab]")].map((e) => {
    const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
    const shown = b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && +cs.opacity > 0.05 && b.right > 0 && b.left < innerWidth && b.bottom > 0 && b.top < innerHeight;
    return { label: e.getAttribute("aria-label") || e.textContent.trim(), shown };
  });
  const moved = [...document.querySelectorAll("[data-duo3d-moved]")].map((e) => getComputedStyle(e).display === "none");
  return { ...r, mode: document.documentElement.dataset.duetMode ?? null, btns, moved };
}

async function load(engine) {
  if (engine === "safari") {
    const b = await safari(SIZE);
    return {
      run: async (url) => { await b.goto(url); return b.eval(`async () => { for (let i = 0; i < 300; i++) { const r = (${inspect})(); if (r) { await new Promise((z) => setTimeout(z, 800)); return (${inspect})(); } await new Promise((z) => setTimeout(z, 100)); } return null; }`.replace(/^async \(\) => /, "async function () ")); },
      shot: () => b.screenshot(),
      close: () => b.close(),
    };
  }
  const browser = await (engine === "webkit" ? webkit : chromium).launch();
  let page;
  return {
    run: async (url) => {
      await page?.close();
      page = await browser.newPage({ viewport: SIZE });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForFunction(() => window.__duo3d, null, { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(800);
      return page.evaluate(inspect);
    },
    shot: () => page.screenshot(),
    close: () => browser.close(),
  };
}

// What makes a site's preview wrong, worst first.
function check(r) {
  if (!r) return ["no result: the shell never finished"];
  if (r.error) return [`optimize failed: ${r.error.slice(0, 120)}`];
  const bad = [];
  const shown = r.btns.filter((b) => b.shown).map((b) => b.label);
  if (!r.mode) bad.push("Duet not mounted");
  else if (!shown.length) bad.push("Duet shows nothing");
  if (r.moved.length && !r.moved.every(Boolean)) bad.push("moved element still on the page");
  const mapped = Object.values(r.found ?? {}).filter((m) => m.role !== "none" && m.p >= 0.7).length;
  // A page with a link or two (a skip link, a gate) rightly maps to nothing and keeps Safari's strip.
  if (r.candidates.length >= 3 && !mapped) bad.push("nothing mapped");
  if (r.moved.length && shown.length <= 2) bad.push(`moved ${r.moved.length} but Duet shows only ${shown.join(", ") || "nothing"}`);
  return bad;
}

const rows = [];
for (const engine of engines) {
  let b;
  try { b = await load(engine); } catch (e) { console.log(`${engine}: unavailable (${e.message})`); continue; }
  try {
    for (const s of sites) {
      // A site whose own scripts take it off the proxy (to its own origin) can't be previewed; it stays listed so
      // the report says so.
      if (s.skip) { console.log(`skip ${engine.padEnd(8)} ${s.url.padEnd(44)} ${s.skip}`); continue; }
      const name = s.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\W+/g, "_").replace(/_$/, "");
      let r = null, err;
      try { r = await b.run(`${base}/duo3d/web?url=${encodeURIComponent(s.url)}`); } catch (e) { err = e.message.split("\n")[0]; }
      try { writeFileSync(join(out, `${name}.${engine}.png`), await b.shot()); } catch {}
      const issues = err ? [`load failed: ${err.slice(0, 120)}`] : check(r);
      const shown = r?.btns?.filter((x) => x.shown).map((x) => x.label) ?? [];
      const roles = (r?.candidates ?? []).map((c) => { const m = r.found?.[c.id]; return m ? { text: c.text, region: c.region, href: c.href, role: m.role, p: +m.p.toFixed(2), icon: m.icon } : { text: c.text }; });
      rows.push({ site: s.url, kind: s.kind, engine, mode: r?.mode, shown, moved: r?.moved?.length ?? 0, issues, roles });
      console.log(`${issues.length ? "FAIL" : "ok  "} ${engine.padEnd(8)} ${s.url.padEnd(44)} ${shown.join(" · ")}${issues.length ? "  <- " + issues.join("; ") : ""}`);
    }
  } finally { await b.close(); }
}

writeFileSync(join(out, "report.json"), JSON.stringify(rows, null, 2));
const md = [`# Duet preview corpus`, ``, `| site | engine | Duet shows | moved | issues |`, `| --- | --- | --- | --- | --- |`,
  ...rows.map((r) => `| ${r.site} | ${r.engine} | ${r.shown.join(" · ")} | ${r.moved} | ${r.issues.join("; ")} |`),
  ``, `## Roles`, ``,
  ...[...new Map(rows.map((r) => [r.site, r])).values()].flatMap((r) => [`### ${r.site}`, ``, ...r.roles.map((c) => `- ${c.role ? `**${c.role}** ${c.p} ${c.icon}` : "-"}: ${JSON.stringify(c.text)} ${c.region ?? ""} ${c.href ?? ""}`), ``])];
writeFileSync(join(out, "report.md"), md.join("\n"));
const failed = rows.filter((r) => r.issues.length);
console.log(`\n${rows.length - failed.length}/${rows.length} ok, report in ${out}`);
process.exit(failed.length ? 1 : 0);
