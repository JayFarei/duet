// The card inspector, as one pure reducer: a card opens in a pane beside the overview where two fit, or full screen
// where they do not; the pane goes full screen and back; Previous and Next step through the cards; Back, Escape and
// the browser's Back step down one level; Close returns to the overview. Each level is one history entry, so the
// reducer says what to do to history and the app does it (pushState, replaceState, history.go). No React, no DOM:
// a vanilla app imports it from `duet-ui/inspector`. props-inspector.test.mjs runs it against a model browser history.
import type { Layout } from "./geometry.ts";
import type { PaneIcon } from "./glyphs.ts";

export { PANE_GLYPHS, type PaneIcon } from "./glyphs.ts";

/** `selected`: the open card, null on the overview. `full`: the card has the whole window (always, where two panes
 *  do not fit). `depth`: how many history entries the inspector has above the overview's, 0 when closed. */
export interface InspectorState { selected: string | null; full: boolean; depth: number }

export type InspectorEvent =
  /** A card's inspect button or a tap on the card. From the overview it opens; while open it swaps the card. */
  | { type: "open"; id: string }
  /** The layout toggle: side by side <-> full screen. */
  | { type: "toggle" }
  /** Back or Escape: one level down. */
  | { type: "back" }
  /** Close: straight back to the overview. */
  | { type: "close" }
  /** Previous (-1) or Next (1), over `ids`. */
  | { type: "step"; delta: 1 | -1 }
  /** The browser moved through history (popstate): the entry's inspector state, null for one without. */
  | { type: "pop"; state: InspectorState | null }
  /** The window changed: whether two panes fit now (canSplit). */
  | { type: "resize"; canSplit: boolean };

/** `ids`: the cards in page order, the ones Previous and Next go through. `canSplit`: two panes fit (canSplit()).
 *  `wrap`: Previous and Next go round at the ends. */
export interface InspectorContext { ids: readonly string[]; canSplit: boolean; wrap: boolean }

/** What the app does to history: "push" pushState(state), "replace" replaceState(state), `{ go }` history.go(go),
 *  null nothing. The popstate a `go` causes comes back as a "pop" event; the returned state already is where it lands. */
export type InspectorHistory = "push" | "replace" | { go: number } | null;
export interface InspectorStep { state: InspectorState; history: InspectorHistory }

export const initialInspector: InspectorState = { selected: null, full: false, depth: 0 };

/** Width from which two panes fit off a Duo: the page and a 164px column beside a pane. */
export const SPLIT_WIDTH = 1050;

/** Whether a card opens beside the overview (true) or full screen (false). One rule: on a Duo Duet's own `layout`
 *  ("wide": the open Duo, upright or turned, full width); elsewhere the window's width, `offDuo` (default 1050). */
export function canSplit(d: { duo: boolean; layout: Layout; width: number }, t: { offDuo?: number } = {}): boolean {
  return d.duo ? d.layout === "wide" : d.width >= (t.offDuo ?? SPLIT_WIDTH);
}

/** The card `delta` steps from `id` in `ids`, going round the ends when `wrap`, else undefined past them. From an id
 *  not in the list (a summary tile), Next goes to the first and Previous to the last. undefined for an empty list. */
export function stepCard(ids: readonly string[], id: string | null, delta: number, wrap = true): string | undefined {
  const n = ids.length;
  if (!n) return undefined;
  const at = id === null ? -1 : ids.indexOf(id);
  const i = at < 0 ? (delta > 0 ? delta - 1 : n + delta) : at + delta;
  if (!wrap && (i < 0 || i >= n)) return undefined;
  return ids[((i % n) + n) % n];
}

export type PaneCommandId = "close" | "toggle" | "previous" | "next";
/** A pane command, shaped like a DuetItem without its handler: map `icon` to a glyph (paneGlyph, PANE_GLYPHS) and
 *  add `onPress`. `disabled` only at an end of the cards when they do not go round. */
export interface PaneCommand { id: PaneCommandId; label: string; icon: PaneIcon; disabled?: boolean }

/** The open pane's commands, in a stable order: Close; the layout toggle where two panes fit, its icon and label the
 *  layout a tap goes to; Previous and Next together while there is another card. Stepping never adds or removes a
 *  command, so nothing moves under the finger. `index`: the open card's place in the list, for `wrap: false`. */
export function paneCommands(o: { canSplit: boolean; full: boolean; count: number; wrap?: boolean; index?: number }): PaneCommand[] {
  const out: PaneCommand[] = [{ id: "close", label: "Close", icon: "close" }];
  if (o.canSplit) out.push(o.full ? { id: "toggle", label: "Side by side", icon: "split" } : { id: "toggle", label: "Full screen", icon: "full" });
  if (o.count > 1) {
    const wrap = o.wrap ?? true, i = o.index ?? -1;
    const previous: PaneCommand = { id: "previous", label: "Previous card", icon: "previous" };
    const next: PaneCommand = { id: "next", label: "Next card", icon: "next" };
    if (!wrap && i === 0) previous.disabled = true;
    if (!wrap && i === o.count - 1) next.disabled = true;
    out.push(previous, next);
  }
  return out;
}

const same = (a: InspectorState, b: InspectorState) => a.selected === b.selected && a.full === b.full && a.depth === b.depth;

/** A history entry's state as the inspector's, or null when it holds none (another app's state, a framework's
 *  rewrite, an entry from before the inspector). */
function entry(v: unknown): InspectorState | null {
  if (!v || typeof v !== "object") return null;
  const { selected, full, depth } = v as Record<string, unknown>;
  if (typeof selected !== "string" || typeof full !== "boolean" || typeof depth !== "number" || !Number.isFinite(depth)) return null;
  return { selected, full, depth: Math.max(1, Math.round(depth)) };
}

function next(s: InspectorState, e: InspectorEvent, ctx: InspectorContext): InspectorStep {
  const none: InspectorStep = { state: s, history: null };
  const open = s.selected !== null;
  const close: InspectorStep = { state: initialInspector, history: s.depth > 0 ? { go: -s.depth } : null };
  switch (e.type) {
    case "open": {
      if (!ctx.ids.includes(e.id) || e.id === s.selected) return none;
      // Another card while one is open is the same level: Back still leads to the overview.
      if (open) return { state: { ...s, selected: e.id, full: s.full || !ctx.canSplit }, history: "replace" };
      return { state: { selected: e.id, full: !ctx.canSplit, depth: s.depth + 1 }, history: "push" };
    }
    case "toggle": {
      if (!open || !ctx.canSplit) return none;
      if (!s.full) return { state: { ...s, full: true, depth: s.depth + 1 }, history: "push" };
      // Full screen above the pane's entry steps back down to it; a card that opened full screen (no room for two
      // panes then) has no pane entry under it, so its entry turns into the pane.
      if (s.depth > 1) return { state: { ...s, full: false, depth: s.depth - 1 }, history: { go: -1 } };
      return { state: { ...s, full: false }, history: "replace" };
    }
    case "back": {
      if (!open) return none;
      if (s.full && ctx.canSplit && s.depth > 1) return { state: { ...s, full: false, depth: s.depth - 1 }, history: { go: -1 } };
      // The pane, or full screen with nothing under it: the overview.
      return close;
    }
    case "close": return open ? close : none;
    case "step": {
      if (!open) return none;
      const id = stepCard(ctx.ids, s.selected, e.delta, ctx.wrap);
      if (id === undefined || id === s.selected) return none;
      return { state: { ...s, selected: id, full: s.full || !ctx.canSplit }, history: "replace" };
    }
    case "pop": {
      const at = entry(e.state);
      // An entry without a card, or a card no longer on the page: the overview.
      if (!at || !ctx.ids.includes(at.selected!)) return open ? { state: initialInspector, history: null } : none;
      return { state: { ...at, full: at.full || !ctx.canSplit }, history: null };
    }
    case "resize": {
      if (!open || e.canSplit || s.full) return none;
      return { state: { ...s, full: true }, history: "replace" };
    }
  }
}

/** The next state (the same object when nothing changed, so React bails out) and what to do to history. Unknown ids
 *  and commands with no card open change nothing. */
export function inspector(s: InspectorState, e: InspectorEvent, ctx: InspectorContext): InspectorStep {
  const r = next(s, e, ctx);
  return same(s, r.state) ? { state: s, history: r.history } : r;
}
