// The pre-paint boot script (duet-ui/boot) against stubbed browsers: only Safari's column on the closed Duo and the
// Duo's inner screen with room get anything written; every other device is left untouched.
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

const bootScript = await (await import("../scripts/boot.mjs")).bundle();
const BUDGET = 10_000;
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";

function run({ inner, outer, screen, ua = SAFARI, standalone = false, framed = false, statusBar }) {
  const attrs = new Map(), vars = new Map();
  const metas = statusBar === undefined ? [] : [{ name: "apple-mobile-web-app-status-bar-style", content: statusBar }];
  const head = { appendChild: (m) => metas.push(m) };
  const html = {
    dataset: new Proxy({}, { set: (_, k, v) => (attrs.set(`data-${String(k).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, v), true) }),
    toggleAttribute: (k, on) => (on ? attrs.set(k, "") : attrs.delete(k), on),
    style: { setProperty: (k, v) => vars.set(k, v) },
  };
  const g = {
    innerWidth: inner[0], innerHeight: inner[1], outerWidth: outer[0], outerHeight: outer[1], devicePixelRatio: 3,
    screen: { width: screen[0], height: screen[1], orientation: { angle: 0 } },
    navigator: { userAgent: ua, maxTouchPoints: 5, standalone }, matchMedia: () => ({ matches: false }),
    document: {
      documentElement: html, head, querySelector: () => null, createElement: () => ({}),
      querySelectorAll: (q) => (/apple-mobile-web-app-status-bar-style/.test(q) ? metas.filter((m) => m.name === "apple-mobile-web-app-status-bar-style") : []),
    },
    visualViewport: { height: inner[1], scale: 1 },
  };
  g.window = g; g.top = framed ? {} : g;
  vm.runInNewContext(bootScript, g);
  return { attrs: Object.fromEntries(attrs), vars: Object.fromEntries(vars), statusBar: metas.map((m) => m.content) };
}

// iOS reads the status bar style when the icon is added. With "black" or "default", a wide Home Screen window on the
// open Duo keeps an 84pt black band for the status column outside the page (951 window, 867 page), and Duet then
// reserves 84 more inside it: the cards stop ~170pt short (Gabriele, 2026-11-22). Translucent gives the page the
// whole window and the status column as its safe-area inset, the rail the column docks in.
test("on a Duo the status bar is translucent, whatever the page set; elsewhere it is left alone", () => {
  const duo = {
    "safari tab, closed": { inner: [382, 580], outer: [466, 678], screen: [466, 678] },
    "safari, open wide": { inner: [951, 589], outer: [951, 669], screen: [466, 678] },
    "home screen, black, open wide": { inner: [867, 669], outer: [951, 669], screen: [466, 678], standalone: true },
    "home screen, closed": { inner: [466, 678], outer: [466, 678], screen: [466, 678], standalone: true },
  };
  for (const [name, c] of Object.entries(duo)) {
    for (const statusBar of [undefined, "black", "default", "black-translucent"])
      assert.deepEqual(run({ ...c, statusBar }).statusBar, ["black-translucent"], `${name}, page sets ${statusBar}`);
  }
  const other = {
    iphone: { inner: [402, 774], outer: [402, 874], screen: [402, 874] },
    "ipad home screen": { inner: [1180, 820], outer: [1180, 820], screen: [1180, 820], standalone: true, ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1" },
    "duo framed": { inner: [382, 580], outer: [466, 678], screen: [466, 678], framed: true },
  };
  for (const [name, c] of Object.entries(other)) {
    assert.deepEqual(run({ ...c, statusBar: "black" }).statusBar, ["black"], name);
    assert.deepEqual(run(c).statusBar, [], name);
  }
});

test("Safari's column on the closed Duo: the column mode and its width before the first paint", () => {
  const { attrs, vars } = run({ inner: [382, 580], outer: [466, 678], screen: [466, 678] });
  assert.equal(attrs["data-duet-mode"], "column");
  assert.equal(attrs["data-duet-boot"], "");
  assert.deepEqual(vars, { "--duet-column": "84px", "--duet-vh": "580px", "--duet-inset-bottom": "98px" });
});

test("the Duo's inner screen with room: the controls held back, no cookie, no mode", () => {
  const cases = {
    "safari landscape": { inner: [951, 589], outer: [951, 669], screen: [466, 678] },
    "safari portrait": { inner: [669, 871], outer: [669, 951], screen: [466, 678] },
    "home screen portrait": { inner: [669, 930], outer: [669, 951], screen: [466, 678], standalone: true },
    "home screen landscape": { inner: [951, 648], outer: [951, 669], screen: [466, 678], standalone: true },
  };
  for (const [name, c] of Object.entries(cases))
    assert.deepEqual(run(c), { attrs: { "data-duet-pending": "" }, vars: c.standalone ? {} : { "--duet-inset-right": "84px" }, statusBar: ["black-translucent"] }, name);
});

test("split view: the column, as ever", () => {
  const { attrs } = run({ inner: [385, 571], outer: [469, 669], screen: [466, 678] });
  assert.equal(attrs["data-duet-mode"], "column");
});

test("the script stays small enough to inline in every page", () => {
  assert.ok(bootScript.length < BUDGET, `${bootScript.length} bytes`);
});

test("every other device and posture: nothing written", () => {
  const cases = {
    iphone: { inner: [402, 774], outer: [402, 874], screen: [402, 874] },
    "duo home screen app": { inner: [382, 678], outer: [466, 678], screen: [466, 678], standalone: true },
    "duo chrome": { inner: [382, 580], outer: [466, 678], screen: [466, 678], ua: SAFARI.replace("Version/27.1", "CriOS/140.0") },
    "duo framed": { inner: [382, 580], outer: [466, 678], screen: [466, 678], framed: true },
    desktop: { inner: [1440, 900], outer: [1440, 980], screen: [1512, 982], ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/27.0 Safari/605.1.15" },
  };
  for (const [name, c] of Object.entries(cases)) {
    const { attrs, vars } = run(c);
    assert.deepEqual({ attrs, vars }, { attrs: {}, vars: {} }, name);
  }
});
