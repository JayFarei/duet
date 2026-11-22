"use client";
// How an organism inside <Duet> hands its commands to Duet's capsule: Duet provides the context, the organism calls
// useDuetActions(items). Duet draws the last published set as its `actions` unless the app passes `actions` itself.
import { createContext, useContext, useEffect, useLayoutEffect, useRef } from "react";
import type { DuetItem } from "./chrome.tsx";

export type PublishActions = (owner: object, items: DuetItem[] | null) => void;
export const DuetActionsContext = createContext<PublishActions | null>(null);

const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** What changes the capsule: a new set of buttons, a label or a disabled state, not a new handler each render. */
const signature = (items: readonly DuetItem[]) => items.map((i) => [i.id, i.label, i.disabled ? 1 : 0, i.badge ?? "", i.badgeTone ?? "", i.tint ?? "", i.destructive ? 1 : 0, i.folded ? 1 : 0].join("\u0001")).join("\u0002");

/** Publishes `items` as the capsule's actions of the enclosing <Duet> (null or undefined: none) and returns whether
 *  there is a <Duet> to take them. Handlers are read at press time, so passing new closures each render is free; the
 *  capsule redraws only when an id, label, badge or disabled state changes. Unmounting withdraws them. */
export function useDuetActions(items: readonly DuetItem[] | null | undefined): boolean {
  const publish = useContext(DuetActionsContext);
  const owner = useRef({});
  const latest = useRef(items);
  latest.current = items;
  const sig = items ? signature(items) : null;
  useLayout(() => {
    if (!publish) return;
    const now = latest.current;
    publish(owner.current, now ? now.map((i) => ({ ...i, onPress: () => latest.current?.find((x) => x.id === i.id)?.onPress?.() })) : null);
  }, [publish, sig]);
  useLayout(() => () => publish?.(owner.current, null), [publish]);
  return !!publish;
}
