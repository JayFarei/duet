// Theming: the props write the same --duet-* vars plain CSS can set, and the stylesheet keeps those tokens.
// Run: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { glassTheme, themeVars } from "../src/theme.ts";

const css = readFileSync(new URL("../src/duet.css", import.meta.url), "utf8");

test("themeVars maps tint and icons to vars, numbers as px, and leaves unset fields to CSS", () => {
  assert.deepEqual(themeVars({}), {});
  assert.deepEqual(themeVars({ tint: "#ff2d55", icons: { size: 21, tabSize: "1.5rem", weight: 1.5, color: "gray" } }), {
    "--duet-tint": "#ff2d55", "--duet-icon-size": "21px", "--duet-tab-icon-size": "1.5rem", "--duet-icon-weight": "1.5", "--duet-icon": "gray",
  });
  assert.deepEqual(themeVars({ icons: { weight: 0 } }), { "--duet-icon-weight": "0" });
});

test("appearance picks GlassyUI's theme; auto follows the system; the old dark flag still works", () => {
  assert.equal(glassTheme(), undefined);
  assert.equal(glassTheme("auto"), undefined);
  assert.equal(glassTheme("light"), "light");
  assert.equal(glassTheme("dark"), "dark");
  assert.equal(glassTheme(undefined, true), "dark");
  assert.equal(glassTheme(undefined, false), "light");
  assert.equal(glassTheme("auto", true), undefined, "appearance wins over dark");
});

test("the documented tokens have defaults on .duet", () => {
  const base = css.slice(css.indexOf(".duet {"), css.indexOf("}", css.indexOf(".duet {")));
  for (const t of ["--duet-tint", "--duet-ink", "--duet-icon-size", "--duet-tab-icon-size", "--duet-icon-weight", "--duet-badge", "--duet-badge-neutral",
    "--duet-badge-ink", "--duet-solid", "--duet-frost", "--duet-menu", "--duet-sel", "--duet-lift"]) assert.match(base, new RegExp(`${t}:`), t);
});

test("neutral badges take the neutral fill", () => assert.match(css, /\.duet-badge\[data-tone="neutral"\] \{ background: var\(--duet-badge-neutral\)/));

test("in Safari's column only the buttons follow the system; menus keep the page appearance", () => {
  const sys = [...css.matchAll(/\.duet\[data-mode="column"\] \.duet-glass:not\(([^)]*)\) \{([^}]*)\}/g)];
  for (const [, not, body] of sys) if (/--duet-(ink|solid):/.test(body)) assert.match(not, /\.duet-menu/, "menus must not get the system ink or solid");
});

test("system glyphs keep their own size and weight", () => {
  for (const rule of css.match(/[^{}]*\{[^}]*--duet-icon-weight\)[^}]*\}/g)) assert.match(rule, /svg:not\(\[data-duet-glyph\]\)/);
});
