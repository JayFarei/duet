"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useDuet } from "./chrome.tsx";
import { backFrom, panes as paneWindow } from "./panes.ts";

export interface DuetPanesProps {
  /** The path of screens, shallowest first, e.g. ["mailboxes", "inbox", "message"]. */
  path: string[];
  /** The focused pane. Narrow shows it alone; wide shows it with the pane before it. */
  at: string;
  /** Each pane's content by id. Every pane stays mounted, so its state and scroll survive folding and
   *  navigation; panes off screen are inert. */
  panes: Record<string, ReactNode>;
}

/** A path of screens that follows the fold: one pane closed or in split view, two adjacent panes unfolded.
 *  Going deeper slides along the path; unfolding slides the neighbouring pane in, folding plays it backwards. */
export function DuetPanes({ path, at, panes }: DuetPanesProps) {
  const { layout } = useDuet();
  const w = paneWindow(path, at, layout);
  return (
    <div className="duet-panes" data-layout={layout}>
      <div className="duet-panes-track" style={{ "--start": w.start, "--n": w.count } as CSSProperties}>
        {path.map((id) => {
          const shown = w.visible.includes(id);
          return <section key={id} className="duet-pane" data-pane={id} data-at={id === at || undefined} inert={!shown} aria-hidden={!shown}>{panes[id]}</section>;
        })}
      </div>
    </div>
  );
}

/** Navigation state for <DuetPanes>: `go` focuses a pane, `back` is ready for <Duet back>: it steps back
 *  along the path, and is false when stepping back would change nothing on screen. */
export function usePanes(path: string[], initial = path[0]) {
  const [at, go] = useState(initial);
  const { layout } = useDuet();
  const to = backFrom(path, at, layout);
  return { at, go, layout, back: to !== null && { onPress: () => go(to) } } as const;
}
