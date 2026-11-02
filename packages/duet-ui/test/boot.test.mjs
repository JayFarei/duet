// The pre-paint boot script (duet-ui/boot) against stubbed browsers: only Safari's column on the closed Duo and the
// Duo's inner screen with room get anything written; every other device is left untouched.
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

const bootScript = await (await import("../scripts/boot.mjs")).bundle();
const BUDGET = 10_000;
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1";

function run({ inner, outer, screen, ua = SAFARI, standalone = false, framed = false }) {
  const attrs = new Map(), vars = new Map();
  const html = {
    dataset: new Proxy({}, { set: (_, k, v) => (attrs.set(`data-${String(k).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, v), true) }),
    toggleAttribute: (k, on) => (on ? attrs.set(k, "") : attrs.delete(k), on),
    style: { setProperty: (k, v) => vars.set(k, v) },
  };
  const g = {
    innerWidth: inner[0], innerHeight: inner[1], outerWidth: outer[0], outerHeight: outer[1], devicePixelRatio: 3,
    screen: { width: screen[0], height: screen[1], orientation: { angle: 0 } },
    navigator: { userAgent: ua, maxTouchPoints: 5, standalone }, matchMedia: () => ({ matches: false }),
    document: { documentElement: html }, visualViewport: { height: inner[1], scale: 1 },
  };
  g.window = g; g.top = framed ? {} : g;
  vm.runInNewContext(bootScript, g);
  return { attrs: Object.fromEntries(attrs), vars: Object.fromEntries(vars) };
}

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
    assert.deepEqual(run(c), { attrs: { "data-duet-pending": "" }, vars: {} }, name);
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
  for (const [name, c] of Object.entries(cases)) assert.deepEqual(run(c), { attrs: {}, vars: {} }, name);
});
