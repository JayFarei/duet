// Path data for the inspector's commands, from Lucide (ISC, https://lucide.dev): x, maximize-2, columns-2,
// chevron-up, chevron-down. Plain strings, no React, so a vanilla app draws the same glyphs as the capsule:
// one `<path d>` per entry in a 24x24 viewBox, no fill, stroke currentColor 2, round caps and joins.

export const X: readonly string[] = ["M18 6 6 18", "m6 6 12 12"];
export const Maximize2: readonly string[] = ["M15 3h6v6", "m21 3-7 7", "m3 21 7-7", "M9 21H3v-6"];
export const Columns2: readonly string[] = ["M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M12 3v18"];
export const ChevronUp: readonly string[] = ["m18 15-6-6-6 6"];
export const ChevronDown: readonly string[] = ["m6 9 6 6 6-6"];

/** The icon a pane command shows (PaneCommand.icon). "full" and "split" name the layout a tap goes to. */
export type PaneIcon = "close" | "full" | "split" | "previous" | "next";
export const PANE_GLYPHS: Readonly<Record<PaneIcon, readonly string[]>> = {
  close: X, full: Maximize2, split: Columns2, previous: ChevronUp, next: ChevronDown,
};
