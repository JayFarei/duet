// The templated column (#181): one template on every layout. The menu (burger) first, then the developer's actions
// while they fit, then "…", which closes the group and grows into the full list. Pure layout: chrome.tsx draws it.
import { DUO, RAIL, columnBand, type Context, type Side } from "./geometry.ts";

/** Duo metrics: button, stacked item pitch, gap between groups, strip centre from the edge, menu row, list pad and
 *  header, and menu width. */
export const TEMPLATE = { control: DUO.control, item: DUO.groupItem, gap: DUO.gap, edge: DUO.centerFromEdge, row: 44, pad: 6, head: 26, menuWidth: 232 } as const;
const T = TEMPLATE;

/** A group of n buttons in one capsule. */
export const groupHeight = (n: number) => T.control + (n - 1) * T.item;

/** A damped spring as a CSS linear() easing (Safari 17.2+), with the time it takes to settle. */
export function spring(stiffness: number, damping: number, n = 40) {
  const w0 = Math.sqrt(stiffness), z = damping / (2 * w0), wd = w0 * Math.sqrt(1 - z * z);
  const x = (t: number) => 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
  const end = -Math.log(0.002) / (z * w0);
  return { easing: `linear(${Array.from({ length: n + 1 }, (_, i) => +x((i / n) * end).toFixed(4)).join(",")})`, ms: Math.round(end * 1000) };
}
/** The sidebar's slide and the groups' moves. */
export const SLIDE = spring(210, 25), GROUP = spring(240, 26);
/** One spring drives the whole "…" morph, open and close, interruptible either way with its velocity kept. Closing,
 *  the tint and the list leave at once, over CLEAR_MS, and what collapses into the button is clear glass. */
export const MORPH_OPEN = { stiffness: 300, damping: 30 }, MORPH_CLOSE = { stiffness: 380, damping: 37 };
export const CLEAR_MS = 110;
/** s plus k·s(1-s)²: 0 to 1 with slope 1 at 1 (so a spring's overshoot carries on smoothly), leading for k > 0
 *  (up to 3), lagging for k < 0 (down to -1). */
export const lead = (s: number, k: number) => s + k * s * (1 - s) * (1 - s);

export type Slot = { kind: "menu" } | { kind: "more" } | { kind: "close" } | { kind: "primary" } | { kind: "action"; index: number };
export type Group = Slot[];

/** The roomiest arrangement that fits `h`: every action shown, then fewer with "…" closing the group. The primary
 *  keeps its own group while any arrangement leaves room for it, else it sits `beside` the stack, out toward the page
 *  (the closed Duo's band holds two buttons), and joins the "…" list only where no stack fits at all. Most actions
 *  shown wins.
 *  `split`: a lone menu button breaks ties (inline; in the column a second capsule's gap would push the stack toward
 *  Safari's own buttons). `rest`: the list holds items whatever fits, so "…" always shows. `extra`: what a lone group
 *  may take beyond `h`. */
export function allocate(h: number, n: number, o: { menu?: boolean; primary?: boolean; split?: boolean; rest?: boolean; extra?: number } = {}): { groups: Group[]; shown: number; primary: boolean; beside?: boolean } {
  if (!o.menu && !n && !o.primary && !o.rest) return { groups: [], shown: 0, primary: false };
  const B: Slot[] = o.menu ? [{ kind: "menu" }] : [], M: Slot = { kind: "more" }, P: Group = [{ kind: "primary" }];
  const it = (k: number): Slot[] => Array.from({ length: k }, (_, index) => ({ kind: "action", index }));
  const height = (gs: Group[]) => gs.reduce((s, g) => s + groupHeight(g.length), 0) + (gs.length - 1) * T.gap;
  const tries: { groups: Group[]; shown: number; score: number; beside?: boolean }[] = [];
  const add = (groups: Group[], shown: number, score: number, beside?: boolean) => { groups = groups.filter((g) => g.length); if (groups.length) tries.push({ groups, shown, score, beside }); };
  for (const p of o.primary ? [[P], []] : [[]]) {
    const bonus = p.length ? 1000 : 0;
    for (let k = n; k >= 0; k--) {
      const tail = k < n || o.rest || (o.primary && !p.length) ? [M] : [];
      if (o.split && o.menu) add([B, [...it(k), ...tail], ...p], k, bonus + k * 10 + 1);
      add([[...B, ...it(k), ...tail], ...p], k, bonus + k * 10);
      if (p.length) add([[...B, ...it(k), ...(k < n || o.rest ? [M] : [])]], k, 500 + k * 10, true);
    }
  }
  const fit = tries.filter((t) => height(t.groups) <= h + (t.groups.length === 1 ? o.extra ?? 0 : 0)).sort((a, b) => b.score - a.score)[0];
  if (fit) return { groups: fit.beside ? [...fit.groups, P] : fit.groups, shown: fit.shown, primary: fit.beside || fit.groups.some((g) => g.some((s) => s.kind === "primary")), beside: fit.beside };
  return { groups: [[...B, M].slice(-Math.max(1, Math.floor((h + (o.extra ?? 0) - T.control) / T.item) + 1))], shown: 0, primary: false };
}

/** Where the template goes, in the layer's coordinates (screen points in the column, viewport points elsewhere). */
export interface Frame {
  kind: "column" | "inline";
  side: Side;
  /** The in-app preview's column: one button of room, so only "…". */
  preview: boolean;
  /** The page's height (menus stay in it) and its top inset. */
  ph: number; insetTop: number;
  /** Strip centre line, and the band the groups stay in. */
  cx: number; top: number; bottom: number;
  /** The page-side edge the menu opens past: the column's inner edge, or the strip's. */
  edge: number;
}

/** Column: in the band clear of Safari's column buttons at their worst case (columnBand). Strip and inline: below
 *  the status bar and Dynamic Island, above the home indicator. */
export function frame(c: Context): Frame {
  const band = columnBand(c), right = c.side === "right";
  const cx = right ? (c.mode === "column" ? c.screenWidth : c.width) - T.edge : T.edge;
  const clear = c.clearTop ?? -Infinity;
  if (band) {
    const reach = c.screenWidth - c.width - T.edge;
    return { kind: "column", side: c.side, preview: !!c.preview, ph: c.height, insetTop: Math.max(c.insetTop, clear), cx, top: Math.max(band.top, clear), bottom: band.bottom, edge: right ? cx - reach : cx + reach };
  }
  const strip = c.mode === "strip" && !c.preview;
  const top = Math.max(strip ? DUO.top + DUO.island - c.offsetTop : c.insetTop + DUO.gap, clear);
  const bottom = strip ? c.height - DUO.bottom : c.height - Math.max(c.insetBottom, DUO.gap);
  const edge = right ? cx - T.control / 2 - 4 : cx + T.control / 2 + 4;
  return { kind: "inline", side: c.side, preview: false, ph: c.height, insetTop: Math.max(c.insetTop, clear), cx, top, bottom, edge };
}
/** What a lone group may take beyond the band in the column: all but RAIL.gap of the gap kept on each side. */
export const extra = (f: Frame) => f.kind === "column" ? 2 * T.gap - 2 * RAIL.gap : 0;

export interface Rect { x: number; y: number; w: number; h: number }
/** `primary`: the primary's own tinted capsule. */
export interface Placed { group: Group; rect: Rect; primary: boolean }

/** In the column the stack centres in the band; elsewhere the menu heads the strip and the primary sits at its foot,
 *  under the thumb. `pill`: how far the primary's capsule reaches past a button toward the page, for its label; it
 *  keeps its icon at the column's end. `beside`: the primary (the last group) has no room in the stack and sits next to
 *  it, toward the page, level with its middle. */
export function place(f: Frame, groups: Group[], o: { pill?: number; beside?: boolean } = {}): Placed[] {
  const stack = o.beside ? groups.slice(0, -1) : groups;
  const heights = stack.map((g) => groupHeight(g.length));
  const total = heights.reduce((s, h) => s + h, 0) + (stack.length - 1) * T.gap;
  const x = f.cx - T.control / 2, right = f.side === "right";
  const start = f.kind === "column" ? f.top + (f.bottom - f.top - total) / 2 : f.top;
  const w = T.control + (o.pill ?? 0), pill = (at: number) => right ? at + T.control - w : at;
  let y = start;
  const placed = stack.map((group, i) => {
    const primary = group.length === 1 && group[0].kind === "primary";
    const top = primary && f.kind === "inline" ? f.bottom - T.control : y;
    y += heights[i] + T.gap;
    return { group, rect: primary ? { x: pill(x), y: top, w, h: T.control } : { x, y: top, w: T.control, h: heights[i] }, primary };
  });
  if (!o.beside) return placed;
  const by = (right ? -1 : 1) * (T.control + RAIL.gap);
  return [...placed, { group: groups.at(-1)!, rect: { x: pill(x + by), y: start + total / 2 - T.control / 2, w, h: T.control }, primary: true }];
}

/** The "…" list: beside the column (or strip), aligned to the button's top, or its bottom when the button is in the
 *  page's lower half, kept 12pt inside the page. `heads`: section headers. A list taller than the page scrolls. */
export function menuBox(f: Frame, from: Rect, n: number, heads = 1): Rect {
  const h = Math.min(2 * T.pad + heads * T.head + n * T.row, f.ph - 24), w = T.menuWidth;
  const x = f.side === "right" ? f.edge - 10 - w : f.edge + 10;
  const y = from.y + from.h / 2 > f.ph / 2 ? from.y + from.h - h : from.y;
  return { x, y: Math.min(Math.max(y, Math.max(f.insetTop, 12)), f.ph - 12 - h), w, h };
}

/** The primary's confirmation: its capsule grows into this box beside it, its label over a `confirm` button. */
export const confirmBox = (f: Frame, from: Rect): Rect => menuBox(f, from, 2, 0);

/** What a tap on the primary's row in "…" does (the band has no room for its capsule): the first arms it (its label
 *  turns to `confirm`), the second runs it; `confirm: false` runs at once (#191). */
export const primaryTap = (armed: boolean, confirm?: string | false): "arm" | "run" => armed || confirm === false ? "run" : "arm";

/** The whole template for one frame: a sheet's lone close (when the band has room; the preview's gap holds one), the preview's lone "…", the
 *  open sidebar's lone burger, else allocate. `rest`: items "…" lists whatever fits (folded, destructive, the side
 *  switch). */
export function template(f: Frame, o: { close?: boolean; menu?: boolean; actions: number; primary?: boolean; rest?: boolean; sidebar?: boolean; pill?: number }) {
  const none = (groups: Group[]) => ({ groups, shown: 0, primary: false, beside: false });
  const a = o.close ? none(f.preview || f.bottom - f.top + extra(f) >= T.control ? [[{ kind: "close" }]] : [])
    : f.preview ? none(o.menu || o.actions || o.primary || o.rest ? [[{ kind: "more" }]] : [])
    : o.sidebar ? none([[{ kind: "menu" }]])
    : allocate(f.bottom - f.top, o.actions, { menu: o.menu, primary: o.primary, split: f.kind === "inline", rest: o.rest, extra: extra(f) });
  return { ...a, placed: place(f, a.groups, { pill: o.pill, beside: a.beside }) };
}
