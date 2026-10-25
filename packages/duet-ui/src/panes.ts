import type { Layout } from "./geometry.ts";

/** Which panes of a path of screens show. Narrow: the focused pane alone. Wide: two adjacent panes, the
 *  focused one and the one before it (the first two at the root), so going deeper slides the pair along the
 *  path instead of opening a modal. `start` is the index of the first visible pane, `count` how many show. */
export interface PaneWindow { start: number; count: 1 | 2; visible: string[] }

export function panes(path: string[], at: string, layout: Layout): PaneWindow {
  const i = Math.max(0, path.indexOf(at));
  if (layout === "narrow" || path.length < 2) return { start: i, count: 1, visible: [path[i]] };
  const start = Math.min(Math.max(0, i - 1), path.length - 2);
  return { start, count: 2, visible: path.slice(start, start + 2) };
}

/** Where back goes from `at`, or null when back would change nothing on screen: narrow steps to the previous
 *  pane; wide only once the pair has moved off the root (the previous pane is already showing). */
export function backFrom(path: string[], at: string, layout: Layout): string | null {
  const i = path.indexOf(at);
  if (i < 1) return null;
  if (layout === "wide" && panes(path, at, layout).start === 0) return null;
  return path[i - 1];
}
