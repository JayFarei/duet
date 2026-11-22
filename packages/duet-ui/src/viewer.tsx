"use client";
// A full-screen viewer for one thing on the page (a chart, a table, a photo): a native modal <dialog> with the glass
// column (Close, Previous, Next), focus held inside and returned on close, Escape, and the arrows. Viewers in one
// DuetViewerGroup step through each other in document order, from the group's own registry, never a DOM query.
import { cloneElement, createContext, isValidElement, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { DuetControlColumn, type DuetCommand } from "./controls.tsx";
import { inOrder, inspectorKey, isTyping, viewerStep } from "./organisms.ts";

const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface Entry { id: string; el: () => HTMLElement | null; open: (open: boolean) => void }
interface Group {
  register: (e: Entry) => () => void;
  /** The viewers in document order. */
  ids: () => string[];
  step: (from: string, delta: 1 | -1) => boolean;
  wrap: boolean;
  /** Where focus goes when the group's last viewer closes: what was focused before the first opened. */
  /** `to`: the viewer a step is handing over to, so it keeps `current` and the one it closes gives no focus back. */
  back: { current: HTMLElement | null; to: string | null };
}
const GroupContext = createContext<Group | null>(null);

/** Viewers that step through each other with Previous and Next, in document order. `wrap` (default true) goes round. */
export function DuetViewerGroup({ children, wrap = true }: { children?: ReactNode; wrap?: boolean }) {
  const entries = useRef(new Map<string, Entry>());
  const back = useRef({ current: null as HTMLElement | null, to: null as string | null }).current;
  const group = useMemo<Group>(() => {
    const ordered = () => inOrder([...entries.current.values()], (a, b) => {
      const x = a.el(), y = b.el();
      return !!x && !!y && !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    return {
      register: (e) => { entries.current.set(e.id, e); return () => { if (entries.current.get(e.id) === e) entries.current.delete(e.id); }; },
      ids: () => ordered().map((e) => e.id),
      step: (from, delta) => {
        const to = viewerStep(ordered().map((e) => e.id), from, delta, wrap);
        const next = to === undefined ? undefined : entries.current.get(to);
        if (!next) return false;
        back.to = to!;
        entries.current.get(from)?.open(false);
        next.open(true);
        return true;
      },
      wrap, back,
    };
  }, [wrap, back]);
  return <GroupContext.Provider value={group}>{children}</GroupContext.Provider>;
}

export interface DuetViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The heading, also the dialog's name. */
  title: ReactNode;
  /** Its id in a DuetViewerGroup. Default: generated. */
  id?: string;
  /** Joins this group rather than the nearest DuetViewerGroup; false joins none. */
  group?: false;
  /** A button that opens it: rendered in place, with onClick, aria-haspopup and aria-expanded added. */
  trigger?: ReactElement<{ onClick?: (e: unknown) => void }>;
  /** The column's edge. Default "right". */
  edge?: "left" | "right";
  /** Labels for the column's buttons. */
  labels?: { close?: string; previous?: string; next?: string };
  children?: ReactNode;
}

/** One full-screen viewer, a native modal dialog: the rest of the page is inert while it is up, Tab goes round inside
 *  it, Escape closes it, and focus goes back to what was focused before it opened. In a group, Previous and Next (and
 *  the arrows) close it and open the next viewer, and focus goes back only when the last one closes. */
export function DuetViewer(p: DuetViewerProps) {
  const near = useContext(GroupContext);
  const group = p.group === false ? null : near;
  const auto = useId(), id = p.id ?? auto, titleId = `${id}-title`;
  const dialog = useRef<HTMLDialogElement>(null);
  const own = useRef<HTMLElement | null>(null);
  // The trigger that was clicked: WebKit does not focus a button on click, so activeElement alone would miss it.
  const opener = useRef<HTMLElement | null>(null);
  const change = useRef(p.onOpenChange);
  change.current = p.onOpenChange;
  useEffect(() => group?.register({ id, el: () => dialog.current, open: (o) => change.current(o) }), [group, id]);

  useLayout(() => {
    const d = dialog.current;
    if (!d) return;
    if (p.open && !d.open) {
      const back = group?.back;
      if (!back || back.to !== id) {
        if (back) back.to = null;
        const was = opener.current ?? (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null);
        if (back) back.current = was; else own.current = was;
      }
      opener.current = null;
      d.showModal();
      d.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    } else if (!p.open && d.open) {
      d.close();
      // Stepping to another viewer: it takes focus, and the group keeps where it goes in the end.
      if (group && group.back.to !== null && group.back.to !== id) return;
      const to = group ? group.back.current : own.current;
      if (group) { group.back.current = null; group.back.to = null; } else own.current = null;
      if (to?.isConnected) to.focus();
    }
  }, [p.open]);

  const count = group ? group.ids().length : 1;
  const step = (delta: 1 | -1) => { if (group) group.step(id, delta); };
  const ids = p.open && group ? group.ids() : [];
  const at = ids.indexOf(id);
  const commands: DuetCommand[] = [{ id: "close", label: p.labels?.close ?? "Close", icon: "close", onPress: () => p.onOpenChange(false) }];
  if (p.open && count > 1) {
    const wrap = group!.wrap;
    commands.push(
      { id: "previous", label: p.labels?.previous ?? "Previous", icon: "previous", disabled: !wrap && at === 0, onPress: () => step(-1) },
      { id: "next", label: p.labels?.next ?? "Next", icon: "next", disabled: !wrap && at === ids.length - 1, onPress: () => step(1) },
    );
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === "Tab") { trap(e); return; }
    const k = inspectorKey(e, isTyping(e.target));
    if (k === null || k === "back") return; // Escape: the dialog's own cancel
    e.preventDefault();
    e.stopPropagation();
    step(k);
  };
  const trigger = isValidElement(p.trigger) ? cloneElement(p.trigger, {
    onClick: (e: { currentTarget?: unknown }) => {
      p.trigger!.props.onClick?.(e);
      if (e.currentTarget instanceof HTMLElement) opener.current = e.currentTarget;
      p.onOpenChange(true);
    },
    "aria-haspopup": "dialog", "aria-expanded": p.open,
  } as Record<string, unknown>) : null;
  return (
    <>
      {trigger}
      <dialog ref={dialog} className="duet-viewer" aria-labelledby={titleId} data-edge={p.edge ?? "right"}
        onCancel={(e) => { e.preventDefault(); p.onOpenChange(false); }} onKeyDown={onKeyDown}>
        {p.open && <>
          <h2 id={titleId} tabIndex={-1}>{p.title}</h2>
          <div className="duet-viewer-body">{p.children}</div>
          <DuetControlColumn commands={commands} edge={p.edge} label="Viewer controls" />
        </>}
      </dialog>
    </>
  );
}

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"]), [contenteditable]:not([contenteditable=\"false\"])";
/** Tab and Shift-Tab go round inside the dialog instead of out to the browser's own controls. */
function trap(e: KeyboardEvent<HTMLDialogElement>) {
  const all = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest("[inert]") && el.getClientRects().length > 0);
  if (!all.length) { e.preventDefault(); return; }
  const first = all[0], last = all[all.length - 1], at = document.activeElement;
  const inside = at instanceof Node && e.currentTarget.contains(at) && at !== e.currentTarget;
  if (e.shiftKey && (at === first || !inside || !all.includes(at as HTMLElement))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (at === last || !inside)) { e.preventDefault(); first.focus(); }
}
