"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDuet, type DuetItem } from "./chrome.tsx";
import { Ellipsis, Maximize, Minimize, X } from "./icons.tsx";
import { useMenuFocus } from "./menu-focus.ts";
import { backFrom, panes as paneWindow } from "./panes.ts";

export interface DuetPanesProps {
  /** The path of screens, shallowest first, e.g. ["mailboxes", "inbox", "message"]. */
  path: string[];
  /** The focused pane. Narrow shows it alone; wide shows it with the pane before it. */
  at: string;
  /** The focused pane takes the whole window (the pane bar's full-screen toggle). */
  expanded?: boolean;
  /** Each pane's content by id. Every pane stays mounted, so its state and scroll survive folding and
   *  navigation; panes off screen are inert. */
  panes: Record<string, ReactNode>;
}

/** A path of screens that follows the fold: one pane closed or in split view, two adjacent panes unfolded.
 *  Going deeper slides along the path; unfolding slides the neighbouring pane in, folding plays it backwards.
 *  Each pane gets its own --duet-inset-left/right: only a pane on the controls' edge keeps clear of them, so
 *  column() and bleed() inside a pane work as they do on a whole page. */
export function DuetPanes({ path, at, expanded = false, panes }: DuetPanesProps) {
  const { layout } = useDuet();
  const w = paneWindow(path, at, layout, expanded);
  const last = w.start + w.count - 1;
  return (
    <div className="duet-panes" data-layout={layout}>
      <div className="duet-panes-track" style={{ "--start": w.start, "--n": w.count } as CSSProperties}>
        {path.map((id, i) => {
          const shown = w.visible.includes(id);
          const insets = {
            "--duet-inset-left": i <= w.start ? "var(--duet-edge-left, 0px)" : "0px",
            "--duet-inset-right": i >= last ? "var(--duet-edge-right, 0px)" : "0px",
          } as CSSProperties;
          return <section key={id} className="duet-pane" style={insets} data-pane={id} data-at={id === at || undefined} inert={!shown} aria-hidden={!shown}>{panes[id]}</section>;
        })}
      </div>
    </div>
  );
}

/** Navigation state for <DuetPanes>: `go` focuses a pane, `back` (`{ onPress }` or false) backs a Back action of your own: it leaves full
 *  screen first, then steps back along the path, and is false when that would change nothing on screen.
 *  `expanded`/`toggle` drive the full-screen toggle and `close` closes the focused pane (back to the pair
 *  before it), both ready for <DuetPaneBar>. */
export function usePanes(path: string[], initial = path[0]) {
  const [at, setAt] = useState(initial);
  const [expanded, setExpanded] = useState(false);
  const { layout } = useDuet();
  const go = (id: string) => { setAt(id); setExpanded(false); };
  const to = backFrom(path, at, layout);
  const prev = path[path.indexOf(at) - 1];
  return {
    at, go, layout, expanded,
    toggle: () => setExpanded((e) => !e),
    close: prev === undefined ? undefined : () => go(prev),
    back: expanded && layout === "wide" ? { onPress: () => setExpanded(false) } : to !== null && { onPress: () => go(to) },
  } as const;
}

export interface DuetPaneBarProps {
  /** Close the pane, e.g. usePanes().close. Omitted: no close button. */
  onClose?: () => void;
  /** Full-screen toggle, e.g. usePanes().toggle. Shown only where two panes fit. */
  onToggle?: () => void;
  expanded?: boolean;
  /** Items for the "…" menu. Destructive ones go last, in red, after a separator. */
  more?: DuetItem[];
}

/** The pane's own controls, a small pill at its top right: close, full screen, and "…". It sticks to the top of
 *  the pane as it scrolls, and keeps clear of the strip when the pane is on the controls' edge. */
export function DuetPaneBar({ onClose, onToggle, expanded = false, more = [] }: DuetPaneBarProps) {
  const { layout } = useDuet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useMenuFocus(menuRef, open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener("pointerdown", off, true);
    return () => removeEventListener("pointerdown", off, true);
  }, [open]);
  const items = [...more.filter((m) => !m.destructive), ...more.filter((m) => m.destructive)];
  const pick = (m: DuetItem) => () => { setOpen(false); m.onPress?.(); };
  const full = !!onToggle && layout === "wide";
  if (!onClose && !full && !items.length) return null;
  return (
    <div className="duet-pane-bar" ref={ref}>
      <div className="duet-pane-pill">
        {onClose && <button aria-label="Close" onClick={onClose}><X size={18} /></button>}
        {full && <button aria-label={expanded ? "Exit full screen" : "Full screen"} aria-pressed={expanded} onClick={onToggle}>{expanded ? <Minimize size={17} /> : <Maximize size={17} />}</button>}
        {items.length > 0 && <button aria-label="More" aria-expanded={open} onClick={() => setOpen(!open)}><Ellipsis size={20} /></button>}
      </div>
      {open && (
        <div ref={menuRef} className="duet-pane-menu" role="menu" aria-label="Pane actions">
          {items.map((m, i) => (
            <button key={m.id} role="menuitem" onClick={pick(m)} data-destructive={m.destructive || undefined}
              data-sep={(m.destructive && !items[i - 1]?.destructive && i > 0) || undefined}>
              <span>{m.label}</span>{m.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
