// Before the first paint (an inline script at the top of <body>, see ./boot): a page in Safari's column on the Duo
// carries data-duet-mode="column" and the column's width from its first frame, where React would only set them once
// mounted, so CSS keyed on the column (a band bled into it, controls moved there) never flashes the plain layout.
// An inline page on the Duo gets its inset the same way, so its content does not jump 84pt on mount.
// Every other browser and device is left untouched: no attribute, no variable. useDuet() hands over once mounted.
import { INLINE_WIDTH, detect, isDuo, isPreview, openRoom, previewPending, type Signals } from "./geometry.ts";
import { measure } from "./measure.ts";

/** The attributes and variables boot() may set, so the mounted chrome can take them back (unboot). */
export const BOOT_VARS = ["--duet-column", "--duet-vh", "--duet-inset-bottom"] as const;

const STATUS_BAR = "apple-mobile-web-app-status-bar-style";
/** On a Duo (not in a frame), the Home Screen status bar style is "black-translucent", whatever the page set. iOS reads it
 *  when the icon is added. With "black" or "default" a wide web app on the open Duo keeps an 84pt band for the status
 *  column outside the page (a 951 window, an 867 page), and the controls reserve 84 more inside it: a dead gutter.
 *  Translucent gives the page the whole window and the status column as its safe-area inset, the rail the controls
 *  dock in (strip mode). Every other device keeps the page's own style (an iPad app keeps "black"). Browser only. */
export function duoStatusBar(s: Signals): void {
  if (!isDuo(s) || s.framed) return;
  const metas = document.querySelectorAll<HTMLMetaElement>(`meta[name="${STATUS_BAR}"]`);
  if (!metas.length) { const m = document.createElement("meta"); m.name = STATUS_BAR; m.content = "black-translucent"; document.head.appendChild(m); }
  for (const m of metas) if (m.content !== "black-translucent") m.content = "black-translucent";
}

export function boot(): void {
  const s = measure(), c = detect(s), h = document.documentElement;
  try { first(s, c, h); } finally { duoStatusBar(s); }
}

/** What the first paint needs, before the status bar style (which only matters when the icon is added). */
function first(s: Signals, c: ReturnType<typeof detect>, h: HTMLElement): void {
  // The in-app preview, or a page that reads as one once its inset lands (it reads 0 here): the server-rendered
  // controls stand at a tab's places, over the preview's own buttons, until the mounted chrome places them (#143).
  if (isPreview(s) || previewPending(s)) h.toggleAttribute("data-duet-pending", true);
  // The inner screen: the server-rendered controls stand at the closed screen's places, so they wait for the mounted chrome.
  if (openRoom(s, c)) h.toggleAttribute("data-duet-pending", true);
  if (openRoom(s, c) && c.mode === "inline" && !c.standalone) h.style.setProperty(`--duet-inset-${c.side}`, `${INLINE_WIDTH}px`);
  if (c.mode !== "column") return;
  h.dataset.duetMode = "column";
  h.toggleAttribute("data-duet-boot", true);
  if (c.split) h.toggleAttribute("data-duet-split", true);
  h.style.setProperty("--duet-column", `${c.screenWidth - c.width}px`);
  h.style.setProperty("--duet-vh", `${c.stableHeight}px`);
  h.style.setProperty("--duet-inset-bottom", `${Math.max(0, c.screenHeight - c.height - c.offsetTop)}px`);
}

/** Takes back what boot() set when the mounted reading is not the column after all. Browser only. */
export function unboot(): void {
  const h = document.documentElement;
  if (!h.hasAttribute("data-duet-boot")) return;
  h.removeAttribute("data-duet-boot");
  delete h.dataset.duetMode;
  h.removeAttribute("data-duet-split");
  for (const v of BOOT_VARS) h.style.removeProperty(v);
}
