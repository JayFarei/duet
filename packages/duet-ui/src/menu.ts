// What is open: "…" (more), the sidebar (the burger's) and the primary's confirmation box (ask), as one pure reducer.
// chrome.tsx sends it every tap, timer and layout change and draws what it returns; props-menu.test.mjs runs it as a model.

/** "closing": still drawn while it animates shut (the morph's spring, the page's slide back), then "closed". */
export type Phase = "open" | "closing" | "closed";
/** `armed`: the folded primary's row in "…" took its first tap (primaryTap) and waits for the second. */
export interface Menus { more: Phase; sidebar: Phase; ask: Phase; armed: boolean }
export type Surface = "more" | "ask";

export type MenuEvent =
  /** A place picked: its tab, its row in "…" or in the sidebar. */
  | { type: "place" }
  | { type: "burger" }
  | { type: "more" }
  /** The primary's own button. `confirm`: it opens the box (else it runs at once). */
  | { type: "primary"; confirm: boolean }
  | { type: "action" }
  /** A row in "…". `arm`: the folded primary's first tap. */
  | { type: "row"; arm: boolean }
  /** "Move controls": the list goes at once, the controls change edge under it. */
  | { type: "move" }
  /** The box's confirm button. */
  | { type: "confirm" }
  /** A morph's close spring settled. */
  | { type: "closed"; surface: Surface }
  /** The page finished sliding back. */
  | { type: "slid" }
  /** A touch on the page, outside the controls. */
  | { type: "outside" }
  /** A touch in Safari's column that hits no button. */
  | { type: "miss" }
  /** A touch on the slid page. */
  | { type: "page" }
  /** A new window on a Duo, a new tabs form, a drag across the page: nothing stays open. */
  | { type: "reset" }
  /** A new sheet layout (sheetLayout). */
  | { type: "sheet" }
  /** Every copy shows its places as tabs: no burger, so no sidebar. */
  | { type: "tabs" }
  /** A sheet's close takes the column. */
  | { type: "close" }
  /** The capsule a surface grows from left the template (a new page, no room). */
  | { type: "gone"; surface: Surface };

/** `swallow`: the touch only dismissed, so its click must not reach the page (swallowClick). */
export interface Step { state: Menus; swallow: boolean }

export const CLOSED: Menus = { more: "closed", sidebar: "closed", ask: "closed", armed: false };

const shut = (p: Phase): Phase => (p === "open" ? "closing" : p);
const flip = (p: Phase): Phase => (p === "open" ? "closing" : "open");
const settle = (p: Phase): Phase => (p === "closing" ? "closed" : p);

/** The outside-touch listener is up: something is open, closing or armed. */
export const listening = (s: Menus) => s.more !== "closed" || s.armed || s.ask !== "closed";

const dismiss = (s: Menus): Menus => ({ ...s, more: shut(s.more), armed: false, ask: shut(s.ask) });
const reset = (s: Menus): Menus => ({ ...s, more: "closed", armed: false, ask: "closed" });

function next(s: Menus, e: MenuEvent): Menus {
  switch (e.type) {
    case "place": return dismiss({ ...s, sidebar: shut(s.sidebar) });
    case "burger": { const d = dismiss(s); return { ...d, sidebar: flip(d.sidebar) }; }
    case "more": return { ...s, armed: false, ask: shut(s.ask), more: flip(s.more) };
    case "primary": return { ...s, more: shut(s.more), ask: e.confirm ? flip(s.ask) : s.ask };
    case "action": return dismiss(s);
    case "row": return e.arm ? { ...s, armed: true } : dismiss(s);
    case "move": return { ...s, more: "closed" };
    case "confirm": return { ...s, ask: "closing" };
    case "closed": return { ...s, [e.surface]: settle(s[e.surface]) };
    case "slid": return { ...s, sidebar: settle(s.sidebar) };
    case "outside": return listening(s) ? dismiss(s) : s;
    case "miss": return listening(s) ? dismiss(s) : s;
    case "page": return { ...s, sidebar: shut(s.sidebar) };
    case "reset": return reset(s);
    case "sheet": case "tabs": return { ...s, sidebar: "closed" };
    case "close": return { ...reset(s), sidebar: shut(s.sidebar) };
    // Its morph unmounts with it, so the close spring never settles: closed now (#262).
    case "gone": return e.surface === "ask" ? { ...s, ask: "closed" } : { ...s, more: "closed", armed: false };
  }
}

const same = (a: Menus, b: Menus) => a.more === b.more && a.sidebar === b.sidebar && a.ask === b.ask && a.armed === b.armed;

/** The next state, the same object when nothing changed (so React bails out), and whether the touch's click stops:
 *  only the tap that dismisses an open surface (#253a), never one while it closes or once it is gone (#262). */
export function menus(s: Menus, e: MenuEvent): Step {
  const n = next(s, e);
  return { state: same(s, n) ? s : n, swallow: e.type === "outside" && (s.more === "open" || s.ask === "open") };
}
