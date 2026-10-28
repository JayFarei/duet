// Replays a real phone's ?trace (apps/site e2e-reporter, $DUET_TRACE) through this checkout's stable(), to see what the
// library would place for each frame the phone recorded, against what the phone's build placed (#132).
//   node tools/e2e/replay-trace.mjs device-trace.jsonl [--all]
// Prints each frame whose mode changes (or every frame with --all): time, the page's signals, recorded and replayed mode.
// A frame worth a unit test goes into packages/duet-ui/test/device.test.mjs as signals.
import { readFileSync } from "node:fs";
import { stable } from "../../packages/duet-ui/src/geometry.ts";

const [file, flag] = process.argv.slice(2);
if (!file) throw new Error("usage: node tools/e2e/replay-trace.mjs <trace.jsonl> [--all]");
const rows = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).sort((a, b) => a.t - b.t);
let d = { flips: [] }, path, t0 = rows[0]?.t ?? 0, prev = "", off = 0;
for (const r of rows) {
  if (r.path !== path) { d = { flips: [] }; path = r.path; console.log(`-- ${path}`); }
  const g = r.sig, rec = r.nav?.mode ?? "none";
  const c = stable(d, g, undefined, r.t, r.nav?.settling === "true");
  const line = `${String(r.t - t0).padStart(7)}ms ${g.innerWidth}x${g.innerHeight} in ${g.outerWidth}x${g.outerHeight} vv ${Math.round(r.vv?.h ?? 0)} editing ${g.editing} y ${Math.round(r.y)} | recorded ${rec} replayed ${c.mode}${c.keyboard ? " kb" : ""}${c.hidden ? " hidden" : ""}`;
  if (rec !== c.mode) off++;
  const key = `${rec} ${c.mode}`;
  if (flag === "--all" || key !== prev) console.log(line);
  prev = key;
}
console.log(`${rows.length} frames, ${off} where this checkout places differently from the phone's build`);
