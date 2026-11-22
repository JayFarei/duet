"use client";
// The inspector's controls off a Duo: a glass column of the open card's commands, the same capsule Duet draws on a Duo
// (duet.css's .duet-group), on the window's edge and clear of its safe areas; and the card's inspect button.
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import type { DuetItem } from "./chrome.tsx";
import type { PaneCommand } from "./inspector.ts";
import { paneGlyph } from "./icons.tsx";
import { hitsControl } from "./organisms.ts";
import { TEMPLATE, groupHeight } from "./template.ts";
import "./duet.css";

/** A command for the column: a DuetItem, or a PaneCommand whose icon is drawn with paneGlyph. */
export type DuetCommand = DuetItem | (PaneCommand & { onPress?: () => void });

export interface DuetControlColumnProps {
  commands: readonly DuetCommand[];
  /** Runs a command that has no onPress of its own, by id: useInspector's `run`. */
  run?: (id: string) => void;
  /** The window edge the column stands on. Default "right". */
  edge?: "left" | "right";
  /** The toolbar's accessible name. Default "Card controls". */
  label?: string;
}

/** The open card's commands in one glass capsule on the window's edge, centred in the height clear of the safe areas:
 *  a toolbar of icon-only buttons, each 49pt tall like Duet's (44pt is the least a target may be), named by its label.
 *  Each carries data-duet-control="actions" and data-command (its id). Nothing when there are no commands. */
export function DuetControlColumn({ commands, run, edge = "right", label = "Card controls" }: DuetControlColumnProps) {
  if (!commands.length) return null;
  const style: CSSProperties = { width: TEMPLATE.control, height: groupHeight(commands.length) };
  return (
    <div className="duet duet-control-column" data-side={edge}>
      <div className="duet-group" role="toolbar" aria-orientation="vertical" aria-label={label} style={style}>
        <i className="duet-edge" aria-hidden />
        <i className="duet-rim" aria-hidden />
        {commands.map((c, j) => {
          const icon: ReactNode = typeof c.icon === "string" ? paneGlyph(c.icon as PaneCommand["icon"], { size: 22, strokeWidth: 2 }) : c.icon;
          const press = () => { if (c.disabled) return; if (c.onPress) c.onPress(); else run?.(c.id); };
          return (
            <button key={c.id} type="button" className="duet-btn" data-duet-control="actions" data-command={c.id} aria-label={c.label} title={c.label}
              aria-disabled={c.disabled || undefined} style={{ top: j * TEMPLATE.item, width: TEMPLATE.control }} onClick={press}>
              {icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface DuetInspectButtonProps {
  /** The accessible name and tooltip, say "Inspect Rent". */
  label: string;
  /** This card is the one open. */
  expanded?: boolean;
  onPress: (trigger: HTMLElement) => void;
  /** Icon size in px. Default 14. */
  size?: number;
  className?: string;
}

/** A card's inspect button: icon only (Maximize2), named by `label`, aria-expanded while its card is open. It hands
 *  itself to onPress, so the inspector can return focus to it on close. */
export function DuetInspectButton({ label, expanded, onPress, size = 14, className }: DuetInspectButtonProps) {
  return (
    <button type="button" className={className ? `duet-inspect ${className}` : "duet-inspect"} data-duet-control="inspect" aria-label={label} title={label} aria-expanded={!!expanded}
      onClick={(e) => { e.stopPropagation(); onPress(e.currentTarget); }}>
      {paneGlyph("full", { size })}
    </button>
  );
}

/** Props for a card a tap anywhere opens, `{...inspectable(open)}`, unless the tap hit a control, link, field or
 *  editable text inside it (hitsControl). The trigger focus returns to: the card's DuetInspectButton, else the card. */
export function inspectable(onOpen: (trigger: HTMLElement) => void) {
  return {
    "data-inspectable": "",
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (e.defaultPrevented || hitsControl(e.target, e.currentTarget)) return;
      // Text selected by a drag across the card is not a tap.
      const sel = getSelection();
      if (sel && !sel.isCollapsed && sel.anchorNode && e.currentTarget.contains(sel.anchorNode)) return;
      // Focus goes back to the card's inspect button where it has one: a card is rarely focusable itself.
      onOpen(e.currentTarget.querySelector<HTMLElement>('[data-duet-control="inspect"]') ?? e.currentTarget);
    },
  } as const;
}
