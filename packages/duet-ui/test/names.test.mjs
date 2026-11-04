// Glossary names (#263): list headings, the Sidebar button and the hooks tests key on, never "Menu" or "This page".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chrome = readFileSync(new URL("../src/chrome.tsx", import.meta.url), "utf8");

test("the More list heads its sections Places and Actions", () => {
  assert.match(chrome, /<div className="duet-menu-head">Places<\/div>/);
  assert.match(chrome, /<div className="duet-menu-head">Actions<\/div>/);
  assert.doesNotMatch(chrome, /"This page"|duet-menu-head">Menu</);
});

test("the sidebar button and the sidebar are named Sidebar", () => {
  assert.match(chrome, /s\.kind === "menu" \? "Sidebar"/);
  assert.match(chrome, /duet-sidebar"[^>]*aria-label="Sidebar"/);
  assert.match(chrome, /<div className="duet-side-head">Sidebar<\/div>/);
});

test("every button carries its control and the controls root its fit", () => {
  assert.match(chrome, /place: "navigation", menu: "sidebar", more: "more", action: "actions", primary: "primary", close: "close"/);
  assert.match(chrome, /className="duet-btn" data-duet-control=\{CONTROL\[s\.kind\]\}/);
  assert.match(chrome, /data-duet-fit=\{fit\}/);
  assert.match(chrome, /tabbed \? \(overflow \? "tabs-more" : "tabs"\) : [^;]*"sidebar" : undefined/);
});
