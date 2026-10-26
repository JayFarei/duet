// e2e beacon: receives the page's Duet state and tags every sample with the step the driver is on.
//   POST /step   {"id": "...", ...meta}  set the current step (driver)
//   GET  /step                           current step
//   POST /beacon <json>                  one sample from the page (text/plain body, no CORS preflight)
//   GET  /samples?step=<id>&since=<ms>   samples received for a step (driver), JSON array
//   POST /cmd    {"op": ...}                driver: queue a device command, answers when the UI-test runner did it
//   GET  /cmd/next                           runner: long-poll for the next command
//   POST /cmd/done {"id", "ok", "error"?}    runner: result
// Every sample is also appended to <out>/samples.jsonl. Usage: node beacon.mjs <port> <outdir>
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const port = Number(process.argv[2] ?? 3141), out = process.argv[3] ?? ".";
fs.mkdirSync(out, { recursive: true });
const log = fs.createWriteStream(path.join(out, "samples.jsonl"), { flags: "a" });
let step = { id: "idle", at: Date.now() };
const byStep = new Map();
const queue = [], waiting = new Map(); // commands for the runner, and driver responses held until done
let runnerPoll = null, cmdId = 0, runnerSeen = 0;
const dispatch = () => { if (runnerPoll && queue.length) { const r = runnerPoll; runnerPoll = null; send(r, 200, queue.shift()); } };

const body = (req) => new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(b)); });
const send = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*" });
  res.end(JSON.stringify(obj));
};

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (u.pathname === "/step" && req.method === "POST") {
    step = { ...JSON.parse((await body(req)) || "{}"), at: Date.now() };
    return send(res, 200, step);
  }
  if (u.pathname === "/step") return send(res, 200, step);
  if (u.pathname === "/beacon" && req.method === "POST") {
    let s;
    try { s = JSON.parse(await body(req)); } catch { return send(res, 400, { error: "bad json" }); }
    const rec = { step: step.id, rx: Date.now(), ...s };
    log.write(JSON.stringify(rec) + "\n");
    if (!byStep.has(step.id)) byStep.set(step.id, []);
    byStep.get(step.id).push(rec);
    return send(res, 200, { ok: true });
  }
  if (u.pathname === "/cmd" && req.method === "POST") {
    const cmd = { ...JSON.parse((await body(req)) || "{}"), id: ++cmdId };
    const timer = setTimeout(() => { waiting.delete(cmd.id); send(res, 504, { ok: false, error: "runner did not answer (is the UI-test runner up?)" }); }, Number(u.searchParams.get("timeout") ?? 60000));
    waiting.set(cmd.id, (r) => { clearTimeout(timer); send(res, 200, r); });
    queue.push(cmd); dispatch();
    return;
  }
  if (u.pathname === "/cmd/next") {
    runnerSeen = Date.now();
    if (runnerPoll) send(runnerPoll, 200, { op: "noop" });
    runnerPoll = res;
    setTimeout(() => { if (runnerPoll === res) { runnerPoll = null; send(res, 200, { op: "noop" }); } }, 2000);
    return dispatch();
  }
  if (u.pathname === "/cmd/done" && req.method === "POST") {
    const r = JSON.parse((await body(req)) || "{}");
    waiting.get(r.id)?.(r); waiting.delete(r.id);
    return send(res, 200, { ok: true });
  }
  if (u.pathname === "/runner") return send(res, 200, { alive: Date.now() - runnerSeen < 5000 });
  if (u.pathname === "/samples") {
    const since = Number(u.searchParams.get("since") ?? 0);
    return send(res, 200, (byStep.get(u.searchParams.get("step")) ?? []).filter((r) => r.rx >= since));
  }
  send(res, 404, { error: "not found" });
}).listen(port, "0.0.0.0", () => console.log(`beacon on :${port}, writing ${out}/samples.jsonl`));
