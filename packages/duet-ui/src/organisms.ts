// The pure parts of the inspector's React organisms (inspector-ui.tsx, viewer.tsx, controls.tsx) and of Duet's
// `rootAttrs` and `scrollTopOnSelect`: no React and no DOM beyond the shapes they are handed, so node:test runs them
// on plain objects (organisms.test.mjs) and a vanilla page can use them from `duet-ui/inspector`.
import type { InspectorState } from "./inspector.ts";
import { stepCard } from "./inspector.ts";

/** What a tap on an inspectable card leaves to the element it hit: controls, links, fields and editable text. */
export const INTERACTIVE = "button, a, input, select, textarea, [data-duet-control], [contenteditable]:not([contenteditable=\"false\"])";

/** Whether a tap at `target` belongs to an interactive element inside the card (so the card does not open), rather
 *  than to the card itself. `target` is anything with `closest` (an Element); a text node or null is the card. Only
 *  elements inside `card` count: the card itself being a link or button does not stop it opening. */
export function hitsControl(target: unknown, card?: unknown): boolean {
  const t = target as { closest?: (s: string) => unknown; parentElement?: unknown } | null;
  const el = t && typeof t.closest === "function" ? t : (t?.parentElement as typeof t) ?? null;
  if (!el || typeof el.closest !== "function") return false;
  const hit = el.closest(INTERACTIVE);
  if (!hit || hit === card) return false;
  const c = card as { contains?: (n: unknown) => boolean } | undefined;
  return !c?.contains || c.contains(hit);
}

/** Keys the inspector and viewer take, from a keydown: "back" (Escape), 1 / -1 (ArrowDown, ArrowUp), or null. With a
 *  modifier held, or while typing in a field, nothing: the page and the browser keep their shortcuts. */
export function inspectorKey(e: { key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; isComposing?: boolean }, typing: boolean): "back" | 1 | -1 | null {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.isComposing) return null;
  if (e.key === "Escape") return "back";
  if (typing) return null;
  if (e.key === "ArrowDown") return 1;
  if (e.key === "ArrowUp") return -1;
  return null;
}

/** Fields where the arrows move the caret or the value: the inspector leaves them alone. */
export const TYPING = "input, select, textarea, [contenteditable]:not([contenteditable=\"false\"])";
export function isTyping(target: unknown): boolean {
  const t = target as { closest?: (s: string) => unknown; isContentEditable?: boolean } | null;
  return !!t && (t.isContentEditable === true || (typeof t.closest === "function" && !!t.closest(TYPING)));
}

// --- history ---------------------------------------------------------------------------------------

/** The key the inspector keeps its level under in `history.state`, beside whatever else the app or its framework
 *  keeps there. */
export const HISTORY_KEY = "duetInspector";

/** `history.state` with the inspector's level written under `key`, everything else kept. */
export function withEntry(state: unknown, s: InspectorState, key = HISTORY_KEY): Record<string, unknown> {
  const base = state && typeof state === "object" ? state as Record<string, unknown> : {};
  return { ...base, [key]: { selected: s.selected, full: s.full, depth: s.depth } };
}

/** The inspector's level in a `history.state`, or null for an entry without one. */
export function readEntry(state: unknown, key = HISTORY_KEY): InspectorState | null {
  if (!state || typeof state !== "object") return null;
  const v = (state as Record<string, unknown>)[key];
  return v && typeof v === "object" ? v as InspectorState : null;
}

/** Whether the current entry lost the inspector's level while a card is open: a framework's router rewrote
 *  `history.state` (replaceState with its own object, or null) and dropped the key. The fix is to write it back. */
export function needsRepair(state: unknown, s: InspectorState, key = HISTORY_KEY): boolean {
  if (s.selected === null) return false;
  const at = readEntry(state, key);
  return !at || at.selected !== s.selected || at.full !== s.full || at.depth !== s.depth;
}

// --- viewer group ----------------------------------------------------------------------------------

/** The viewers of a group in document order: `before(a, b)` says whether a comes first (compareDocumentPosition in the
 *  browser). Registration order is only the order of mounting, which a list that inserts or reorders breaks. */
export function inOrder<T>(items: readonly T[], before: (a: T, b: T) => boolean): T[] {
  return [...items].sort((a, b) => (a === b ? 0 : before(a, b) ? -1 : 1));
}

/** The viewer `delta` steps from `id` in a group's `ids` (document order), going round the ends unless `wrap` is
 *  false. undefined when there is nothing else to go to. */
export function viewerStep(ids: readonly string[], id: string, delta: 1 | -1, wrap = true): string | undefined {
  const to = stepCard(ids, id, delta, wrap);
  return to === id ? undefined : to;
}

// --- Duet's root attributes and scroll to top --------------------------------------------------------

/** `rootAttrs`: Duet's device, layout and mode as attributes on <html>, for app CSS that keys on them before its own
 *  React has run. `prefix` "data-app" gives data-app-device, data-app-layout, data-app-mode. (Not "data-duet": Duet
 *  writes data-duet-mode itself.) */
export function rootAttrs(prefix: string, c: { device: string; layout: string; mode: string }): Record<string, string> {
  const p = prefix.replace(/-+$/, "");
  return { [`${p}-device`]: c.device, [`${p}-layout`]: c.layout, [`${p}-mode`]: c.mode };
}

/** `scrollTopOnSelect`: a place chosen on purpose opens at its top, over the scroll position Duet keeps for each place.
 *  Scrolls the inner scroller and the window, whichever the page uses. */
export function scrollToTop(scroller: { scrollTop: number } | null | undefined, win?: { scrollTo: (x: number, y: number) => void }) {
  if (scroller) scroller.scrollTop = 0;
  win?.scrollTo(0, 0);
}
