// Before the first paint (an inline script at the top of <body>, see ./boot): a page in Safari's column on the Duo
// carries data-duet-mode="column" and the column's width from its first frame, where React would only set them once
// mounted, so CSS keyed on the column (a band bled into it, controls moved there) never flashes the plain layout.
// Every other browser and device is left untouched: no attribute, no variable. useDuet() hands over once mounted.
import { detect, isPreview, previewPending } from "./geometry.ts";
import { measure } from "./measure.ts";

/** The attributes and variables boot() may set, so the mounted chrome can take them back (unboot). */
export const BOOT_VARS = ["--duet-column", "--duet-vh", "--duet-inset-bottom"] as const;

export function boot(): void {
  const s = measure(), c = detect(s), h = document.documentElement;
  // The in-app preview, or a page that reads as one once its inset lands (it reads 0 here): the server-rendered
  // controls stand at a tab's places, over the preview's own buttons, until the mounted chrome places them (#143).
  if (isPreview(s) || previewPending(s)) h.toggleAttribute("data-duet-pending", true);
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
