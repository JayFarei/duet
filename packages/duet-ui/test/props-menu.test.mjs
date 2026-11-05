// Model test of what is open ("…", the sidebar, the primary's confirmation box): random taps, timers and layout changes
// through the real reducer (menu.ts) against a model of booleans. The harness plays chrome.tsx: a morph's spring settles
// only while its capsule is drawn, and a capsule leaving the template sends "gone". DUET_PBT_RUNS overrides the run count.
import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { CLOSED, menus } from "../src/menu.ts";

const runs = Number(process.env.DUET_PBT_RUNS) || 300;

// The real side: the reducer's state plus what the template draws. moreGroup: the "…" capsule; primary: the primary as
// its own capsule (the box grows from it), as a row in "…" (two taps, `armed`) or absent.
const fresh = () => ({ s: CLOSED, env: { moreGroup: true, primary: "capsule" } });
const askGroup = (env) => env.primary === "capsule";
function send(r, e) { const { state, swallow } = menus(r.s, e); r.s = state; return swallow; }

// Every spring that can still finish does: a closing surface whose capsule is drawn, the page sliding back.
function settle(r) {
  if (r.s.more === "closing" && r.env.moreGroup) send(r, { type: "closed", surface: "more" });
  if (r.s.ask === "closing" && askGroup(r.env)) send(r, { type: "closed", surface: "ask" });
  if (r.s.sidebar === "closing") send(r, { type: "slid" });
}

function invariants(m, r) {
  const { s, env } = r;
  assert.equal(s.more === "open", m.more, "more open");
  assert.equal(s.ask === "open", m.ask, "ask open");
  assert.equal(s.sidebar === "open", m.sidebar, "sidebar open");
  assert.equal(s.armed, m.armed, "armed");
  assert.ok(!(s.more === "open" && s.ask === "open"), "more and ask never both open");
  if (!env.moreGroup) assert.ok(s.more === "closed" && !s.armed, `"…" gone but ${s.more}${s.armed ? ", armed" : ""}`);
  if (!askGroup(env)) assert.equal(s.ask, "closed", "box gone");
  // After every spring settles nothing is stuck closing, and once closed an outside tap reaches the page.
  const c = { s, env };
  settle(c);
  for (const k of ["more", "ask", "sidebar"]) assert.notEqual(c.s[k], "closing", `${k} stuck closing`);
  if (c.s.more === "closed" && c.s.ask === "closed") assert.equal(send(c, { type: "outside" }), false, "closed: outside tap swallowed");
}

const dismiss = (m) => { m.more = false; m.ask = false; m.armed = false; };

// One command: when it can happen (from the model and the real env), the model's step, the event(s) it sends.
class Cmd {
  constructor(name, can, step, event) { Object.assign(this, { name, can, step, event }); }
  check() { return true; }
  run(m, r) {
    if (!this.can(m, r)) return;
    const wasOpen = m.more || m.ask, e = this.event(r);
    const swallow = e && send(r, e);
    this.step(m, r);
    if (e?.type === "outside") assert.equal(swallow, wasOpen, `swallow ${swallow}: only the one dismiss tap of an open surface`);
    else assert.equal(!!swallow, false);
    invariants(m, r);
  }
  toString() { return this.name; }
}
const always = () => true;
const ev = (e) => () => e;

const commands = [
  new Cmd("place", always, (m) => { dismiss(m); m.sidebar = false; }, ev({ type: "place" })),
  new Cmd("burger", always, (m) => { dismiss(m); m.sidebar = !m.sidebar; }, ev({ type: "burger" })),
  new Cmd("more", (m, r) => r.env.moreGroup, (m) => { m.armed = false; m.ask = false; m.more = !m.more; }, ev({ type: "more" })),
  new Cmd("primary", (m, r) => askGroup(r.env), (m) => { m.more = false; m.ask = !m.ask; }, ev({ type: "primary", confirm: true })),
  new Cmd("primary-at-once", (m, r) => askGroup(r.env), (m) => { m.more = false; }, ev({ type: "primary", confirm: false })),
  new Cmd("action", always, dismiss, ev({ type: "action" })),
  new Cmd("row", (m, r) => r.env.moreGroup && r.s.more !== "closed", dismiss, ev({ type: "row", arm: false })),
  new Cmd("row-arm", (m, r) => r.env.moreGroup && r.s.more !== "closed" && r.env.primary === "row", (m) => { m.armed = true; }, ev({ type: "row", arm: true })),
  new Cmd("move", (m, r) => r.env.moreGroup && r.s.more !== "closed", (m) => { m.more = false; }, ev({ type: "move" })),
  new Cmd("confirm", (m, r) => askGroup(r.env) && r.s.ask !== "closed", (m) => { m.ask = false; }, ev({ type: "confirm" })),
  new Cmd("spring-more", (m, r) => r.env.moreGroup && r.s.more === "closing", () => {}, ev({ type: "closed", surface: "more" })),
  new Cmd("spring-ask", (m, r) => askGroup(r.env) && r.s.ask === "closing", () => {}, ev({ type: "closed", surface: "ask" })),
  new Cmd("slid", (m, r) => r.s.sidebar === "closing", () => {}, ev({ type: "slid" })),
  new Cmd("outside", always, dismiss, ev({ type: "outside" })),
  new Cmd("miss", always, dismiss, ev({ type: "miss" })),
  new Cmd("page", always, (m) => { m.sidebar = false; }, ev({ type: "page" })),
  new Cmd("reset", always, dismiss, ev({ type: "reset" })),
  new Cmd("sheet", always, (m) => { m.sidebar = false; }, ev({ type: "sheet" })),
  new Cmd("tabs", always, (m) => { m.sidebar = false; }, ev({ type: "tabs" })),
  new Cmd("close", always, (m) => { dismiss(m); m.sidebar = false; }, ev({ type: "close" })),
];

// Exact checks the booleans cannot see: a reset leaves nothing even closing, a sheet or tabs leave no sidebar at all.
class Exact extends Cmd {
  constructor(type, keys) { super(type + "!", always, commands.find((c) => c.name === type).step, ev({ type })); this.keys = keys; }
  run(m, r) { super.run(m, r); for (const k of this.keys) assert.equal(r.s[k], "closed", `${this.name} left ${k} ${r.s[k]}`); }
}
commands.push(new Exact("reset", ["more", "ask"]), new Exact("close", ["more", "ask"]), new Exact("sheet", ["sidebar"]), new Exact("tabs", ["sidebar"]));

// The template changing under the surfaces: a page without "…", a primary that moves into "…" or goes. A capsule that
// leaves sends "gone" (chrome.tsx's effects); its morph unmounts, so its spring never settles.
class Env {
  constructor(key, value) { Object.assign(this, { key, value }); }
  check() { return true; }
  run(m, r) {
    const hadMore = r.env.moreGroup, hadAsk = askGroup(r.env);
    r.env = { ...r.env, [this.key]: this.value };
    if (hadMore && !r.env.moreGroup) { send(r, { type: "gone", surface: "more" }); m.more = false; m.armed = false; }
    if (hadAsk && !askGroup(r.env)) { send(r, { type: "gone", surface: "ask" }); m.ask = false; }
    invariants(m, r);
  }
  toString() { return `${this.key}=${this.value}`; }
}
const envs = [new Env("moreGroup", true), new Env("moreGroup", false), new Env("primary", "capsule"), new Env("primary", "row"), new Env("primary", "none")];

const model = () => ({ more: false, ask: false, sidebar: false, armed: false });
const arb = fc.commands([...commands, ...envs].map((c) => fc.constant(c)), { maxCommands: 40 });

// Replays a named sequence, for the pinned counterexamples.
const play = (...names) => {
  const all = [...commands, ...envs], m = model(), r = fresh();
  for (const n of names) all.find((c) => c.toString() === n).run(m, r);
  return r;
};

test("menu model: random taps, springs and template changes keep every invariant", { todo: "#262: gone more is a no-op, a closing surface swallows" }, () => {
  fc.assert(fc.property(arb, (cmds) => { fc.modelRun(() => ({ model: model(), real: fresh() }), cmds); }), { numRuns: runs });
});

// #262: a row's action takes "…" off the page mid-close. Its morph unmounts, the spring never settles, and every later
// outside tap was swallowed.
test("#262: \"…\" leaving mid-close settles it, the next outside tap reaches the page", { todo: "#262" }, () => {
  const r = play("more", "row", "moreGroup=false");
  assert.equal(r.s.more, "closed");
  assert.equal(send(r, { type: "outside" }), false);
});

// #253a: the tap that dismisses an open "…" stops there (swallowClick); the next one reaches the page.
test("#253a: the dismiss tap of an open \"…\" is swallowed, the next is not", () => {
  const r = fresh();
  send(r, { type: "more" });
  assert.equal(send(r, { type: "outside" }), true);
  settle(r);
  assert.equal(send(r, { type: "outside" }), false);
});

// Armed (the folded primary's first tap) then "Move controls": "…" goes at once, nothing is drawn open, so the next
// outside tap only disarms and reaches the page.
test("armed then Move: the outside tap with nothing open reaches the page", { todo: "swallow follows listening, not an open surface" }, () => {
  const r = play("primary=row", "more", "row-arm", "move");
  assert.equal(r.s.armed, true);
  assert.equal(send(r, { type: "outside" }), false);
  assert.equal(r.s.armed, false);
});
