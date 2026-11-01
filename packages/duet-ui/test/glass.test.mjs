// Light glass (#256): a separate edge ring under the glass, and dark mode keeps none of it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/duet.css", import.meta.url), "utf8");
const chrome = readFileSync(new URL("../src/chrome.tsx", import.meta.url), "utf8");
const count = (text, needle) => text.split(needle).length - 1;

test("the capsule and the menu each draw the edge ring just before the rim", () => {
  assert.equal(count(chrome, 'className="duet-rim"'), 2);
  assert.equal([...chrome.matchAll(/<i className="duet-edge" aria-hidden \/>\s*<i className="duet-rim"/g)].length, 2);
});

test("the edge ring sits under the glass, so its backdrop is the page", () => {
  const rule = css.match(/\.duet-edge\s*\{[^}]*\}/)?.[0];
  assert.ok(rule, ".duet-edge rule");
  assert.match(rule, /z-index:\s*-2/);
  assert.match(rule, /backdrop-filter:\s*var\(--duet-edge-filter\)/);
});

test("both light themes darken the edge and dodge the rim, all three dark themes opt out", () => {
  assert.equal(count(css, "--duet-edge-filter: contrast(1.75) brightness(0.505)"), 2);
  assert.equal(count(css, "--duet-rim-blend: color-dodge"), 2);
  assert.equal(count(css, "--duet-edge-filter: none"), 3);
  assert.equal(count(css, "--duet-rim-blend: normal"), 3);
  assert.equal(count(css, "--duet-glass-inset: 0px"), 3);
});
