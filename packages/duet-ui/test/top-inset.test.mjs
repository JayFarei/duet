// --duet-inset-top adds to the safe area, it never contains it: every page pads by the sum, on every device.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const FORMULA = "calc(env(safe-area-inset-top) + var(--duet-inset-top, 0px))";

test("the inset is set only for the strip's blur, so the sum never counts the safe top twice", () => {
  assert.match(read("../src/chrome.tsx"), /"--duet-inset-top", ctx\.mode === "strip" && ctx\.standalone \? `\$\{DUO\.edgeBlur\}px` : "0px"\)/);
});

test("the library's own use adds the safe area", () => {
  for (const line of read("../src/duet.css").split("\n").filter((l) => l.includes("var(--duet-inset-top")))
    assert.match(line, /env\(safe-area-inset-top\)/);
});

test("the docs give the sum, and say which status bar style to use", () => {
  const doc = read("../../../docs/layout.md");
  assert.ok(doc.includes(FORMULA));
  assert.match(doc, /apple-mobile-web-app-status-bar-style/);
  assert.match(doc, /`default`/);
  assert.match(doc, /`black-translucent`/);
});

test("the edge cases list both Home Screen entries", () => {
  const doc = read("../../../docs/edge-cases.md");
  for (const h of ["Header in the status bar after rotating a Home Screen app", "Blank strip below a Home Screen app"]) {
    assert.ok(doc.includes(`## ${h}`));
    assert.ok(doc.includes(`[${h}](#`));
  }
});
