"use client";
// The card inspector's React layer over the pure core (inspector.ts): useInspector owns the state, history, keys,
// focus and the window's room for two panes; DuetInspector draws the open card, beside the overview or full screen,
// with its commands in Duet's capsule on a Duo (useDuetActions) and in a glass column of its own elsewhere.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDuet, type DuetItem } from "./chrome.tsx";
import { useDuetActions } from "./actions.tsx";
import { DuetControlColumn } from "./controls.tsx";
import { paneGlyph } from "./icons.tsx";
import { canSplit as roomForTwo, inspector, initialInspector, paneCommands, type InspectorEvent, type InspectorState, type PaneCommand, type PaneCommandId } from "./inspector.ts";
import { HISTORY_KEY, inspectorKey, isTyping, needsRepair, readEntry, withEntry } from "./organisms.ts";

const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface UseInspectorOptions {
  /** The cards in page order: the ones Previous and Next go through and a history entry may name. */
  ids: readonly string[];
  /** Controlled state, with onChange. Without it the hook keeps its own. */
  value?: InspectorState;
  onChange?: (state: InspectorState) => void;
  /** "push" (default): one history entry per level, so Back and the browser's Back step down. "none": history stays
   *  untouched. */
  history?: "push" | "none";
  /** Escape (Back) and the arrows (Previous, Next) on the window. Default true. */
  keyboard?: boolean;
  /** Whether two panes fit. Default: the core's canSplit over useDuet() (Duet's layout on a Duo, 1050 elsewhere). */
  canSplit?: boolean;
  /** Previous and Next go round the ends. Default true. */
  wrap?: boolean;
  /** Writes the inspector's level back into the current history entry when a framework's router rewrites
   *  history.state and drops it (Next.js does), so Back and Forward still land on the right level. Default false. */
  repairHistory?: boolean;
  /** The key under history.state. Default "duetInspector". */
  historyKey?: string;
}

export interface Inspector extends InspectorState {
  /** Opens card `id` (swaps the open one). `trigger` gets focus back when the inspector closes. */
  open: (id: string, trigger?: HTMLElement | null) => void;
  close: () => void;
  /** One level down: full screen to the pane, the pane to the overview. */
  back: () => void;
  /** Side by side and full screen. */
  toggle: () => void;
  step: (delta: 1 | -1) => void;
  /** Sends any core event. */
  dispatch: (e: InspectorEvent) => void;
  /** Whether two panes fit now. */
  canSplit: boolean;
  /** The open card's commands (paneCommands), empty on the overview. */
  commands: PaneCommand[];
  /** Runs a command by id. */
  run: (id: string) => void;
  /** The commands as DuetItems, glyph and handler included, for Duet's `actions` or DuetControlColumn. */
  actions: DuetItem[];
  /** Spread on DuetInspector: open, full, onClose and commands. */
  paneProps: { open: boolean; full: boolean; onClose: () => void; commands: DuetItem[] };
}

export function useInspector(o: UseInspectorOptions): Inspector {
  const duet = useDuet();
  const split = o.canSplit ?? roomForTwo(duet);
  const wrap = o.wrap ?? true, mode = o.history ?? "push", key = o.historyKey ?? HISTORY_KEY;
  const [own, setOwn] = useState<InspectorState>(initialInspector);
  const controlled = o.value !== undefined;
  const state = controlled ? o.value! : own;
  // The latest state and options, read by handlers that outlive a render (popstate, keys, the repair poll).
  // `moving`: a history.go is on its way, so the current entry is still the one being left until its popstate.
  const live = useRef({ state, ctx: { ids: o.ids, canSplit: split, wrap }, mode, key, onChange: o.onChange, controlled, moving: false });
  Object.assign(live.current, { state, ctx: { ids: o.ids, canSplit: split, wrap }, mode, key, onChange: o.onChange, controlled });
  const trigger = useRef<HTMLElement | null>(null);

  const dispatch = (e: InspectorEvent) => {
    const L = live.current;
    const r = inspector(L.state, e, L.ctx);
    if (L.mode === "push" && r.history && typeof window !== "undefined") {
      const h = window.history;
      if (r.history === "push") h.pushState(withEntry(h.state, r.state, L.key), "");
      else if (r.history === "replace") h.replaceState(withEntry(h.state, r.state, L.key), "");
      // A go with nowhere to land fires no popstate: give up waiting after a second.
      else { L.moving = true; setTimeout(() => { L.moving = false; }, 1000); h.go(r.history.go); }
    }
    if (r.state === L.state) return;
    L.state = r.state;
    if (!L.controlled) setOwn(r.state);
    L.onChange?.(r.state);
  };
  const ref = useRef(dispatch);
  ref.current = dispatch;
  const send = (e: InspectorEvent) => ref.current(e);

  // The browser moved: adopt the entry's level. On mount, an entry that already holds one (a reload while open).
  useEffect(() => {
    if (mode !== "push") return;
    const at = readEntry(history.state, live.current.key);
    if (at) ref.current({ type: "pop", state: at });
    const pop = (e: PopStateEvent) => { live.current.moving = false; ref.current({ type: "pop", state: readEntry(e.state, live.current.key) }); };
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, [mode]);
  // The room for two panes changed: a pane with none left goes full screen.
  useEffect(() => { ref.current({ type: "resize", canSplit: split }); }, [split]);
  // A framework rewrote the entry (replaceState with its own state, dropping ours): write ours back. Checked after each
  // render and, while a card is open, a few times a second, since a router's rewrite renders nothing of ours.
  useEffect(() => {
    if (!o.repairHistory || mode !== "push") return;
    const repair = () => {
      const L = live.current;
      if (!L.moving && needsRepair(history.state, L.state, L.key)) history.replaceState(withEntry(history.state, L.state, L.key), "");
    };
    repair();
    if (state.selected === null) return;
    const t = setInterval(repair, 150);
    return () => clearInterval(t);
  });

  // Escape steps down a level; the arrows step through the cards. A modifier, a field, a viewer or a key the page
  // took (defaultPrevented) leaves them alone.
  const keyboard = o.keyboard ?? true;
  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || live.current.state.selected === null) return;
      if (document.querySelector("dialog[open]")) return;
      const k = inspectorKey(e, isTyping(e.target));
      if (k === null) return;
      e.preventDefault();
      ref.current(k === "back" ? { type: "back" } : { type: "step", delta: k });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [keyboard]);

  // Focus goes back to what opened the card once it closes, however it closed (Close, Escape, the browser's Back).
  const wasOpen = useRef(state.selected !== null);
  useEffect(() => {
    const isOpen = state.selected !== null;
    if (wasOpen.current && !isOpen) {
      const t = trigger.current;
      trigger.current = null;
      if (t?.isConnected) t.focus();
    }
    wasOpen.current = isOpen;
  }, [state.selected]);

  const index = state.selected === null ? -1 : o.ids.indexOf(state.selected);
  const commands = useMemo(() => state.selected === null ? [] : paneCommands({ canSplit: split, full: state.full, count: o.ids.length, wrap, index }),
    [state.selected, state.full, split, o.ids.length, wrap, index]);
  const run = (id: string) => {
    const c = id as PaneCommandId;
    if (c === "close") send({ type: "close" });
    else if (c === "toggle") send({ type: "toggle" });
    else if (c === "previous") send({ type: "step", delta: -1 });
    else if (c === "next") send({ type: "step", delta: 1 });
  };
  const actions: DuetItem[] = commands.map((c) => ({ id: c.id, label: c.label, icon: paneGlyph(c.icon), disabled: c.disabled, onPress: () => run(c.id) }));
  const open = (id: string, t?: HTMLElement | null) => {
    if (live.current.state.selected === null) trigger.current = t ?? (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null);
    send({ type: "open", id });
  };
  const close = () => send({ type: "close" });
  return {
    ...state, open, close, back: () => send({ type: "back" }), toggle: () => send({ type: "toggle" }), step: (delta) => send({ type: "step", delta }),
    dispatch: send, canSplit: split, commands, run, actions,
    paneProps: { open: state.selected !== null, full: state.full, onClose: close, commands: actions },
  };
}

export interface DuetInspectorProps {
  open: boolean;
  /** The whole window (true), or a pane beside the overview. */
  full: boolean;
  title: ReactNode;
  /** A line above the title (the card's section, say). */
  eyebrow?: ReactNode;
  /** A line under the title. */
  caption?: ReactNode;
  onClose: () => void;
  /** The open card's commands (useInspector's `actions`): in Duet's capsule on a Duo, in a glass column elsewhere. */
  commands: readonly DuetItem[];
  /** More in the header, after the caption. */
  header?: ReactNode;
  /** Shown only full screen, after the body: the detail that needs the room. */
  fullOnly?: ReactNode;
  /** The column's edge off a Duo. Default "right". */
  edge?: "left" | "right";
  children?: ReactNode;
}

/** The open card. A dialog (aside, role="dialog"), labelled by its title, which takes focus on open. Full screen it is
 *  modal: aria-modal, and the page beside it (its siblings) inert. While open <html> carries data-duet-inspector
 *  ("split" or "full"), so the overview can make room for the pane (`--duet-inspector-width`). */
export function DuetInspector(p: DuetInspectorProps) {
  const ctx = useDuet();
  // On a Duo inside <Duet>, the commands go to its capsule; elsewhere the column draws them.
  const capsule = useDuetActions(p.open && ctx.duo ? p.commands : null) && ctx.duo;
  const aside = useRef<HTMLElement>(null), head = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  // Focus the title when a card opens, so a screen reader starts at it and Tab starts in the pane.
  const wasOpen = useRef(false);
  useLayout(() => {
    if (p.open && !wasOpen.current) head.current?.focus({ preventScroll: true });
    wasOpen.current = p.open;
  }, [p.open]);
  // Full screen: everything beside the pane is inert, as a modal's page is.
  useLayout(() => {
    const el = aside.current;
    if (!p.open || !p.full || !el?.parentElement) return;
    const made = [...el.parentElement.children].filter((c): c is HTMLElement => c !== el && c instanceof HTMLElement && !c.inert);
    for (const c of made) c.inert = true;
    return () => { for (const c of made) c.inert = false; };
  }, [p.open, p.full]);
  useLayout(() => {
    if (!p.open) return;
    const h = document.documentElement;
    h.dataset.duetInspector = p.full ? "full" : "split";
    return () => { delete h.dataset.duetInspector; };
  }, [p.open, p.full]);
  if (!p.open) return null;
  return (
    <aside ref={aside} className="duet-inspector" data-full={p.full || undefined} data-capsule={capsule || undefined} data-edge={p.edge ?? "right"}
      role="dialog" aria-modal={p.full || undefined} aria-labelledby={titleId}>
      <header className="duet-inspector-head">
        {p.eyebrow !== undefined && <p className="duet-inspector-eyebrow">{p.eyebrow}</p>}
        <h2 ref={head} id={titleId} tabIndex={-1}>{p.title}</h2>
        {p.caption !== undefined && <p className="duet-inspector-caption">{p.caption}</p>}
        {p.header}
      </header>
      <div className="duet-inspector-body">
        {p.children}
        {p.full && p.fullOnly}
      </div>
      {!capsule && <DuetControlColumn commands={p.commands} edge={p.edge} />}
    </aside>
  );
}
