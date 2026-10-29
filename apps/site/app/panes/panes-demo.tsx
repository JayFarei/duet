"use client";

import type { CSSProperties, ReactNode } from "react";
import { Archive, ArrowLeft, ChevronRight, FileText, Forward, Inbox, Paperclip, Reply, Send, SquarePen, Star, Trash2 } from "lucide-react";
import { Duet, DuetPaneBar, DuetPanes, bleed, usePanes, type DuetItem } from "duet-ui";
import { WebDuo, useDesktop } from "../duo/web-duo";

const PATH = ["mailboxes", "inbox", "message", "attachment"];
const MAILBOXES: [string, ReactNode, number][] = [["Inbox", <Inbox size={20} />, 3], ["Starred", <Star size={20} />, 0], ["Sent", <Send size={20} />, 0], ["Archive", <Archive size={20} />, 0], ["Trash", <Trash2 size={20} />, 0]];
const MAIL = [
  ["Ada", "Fold test results", "The hinge held for 200k cycles. Numbers attached."],
  ["Grace", "Split view notes", "Two panes beside the strip read better than a modal."],
  ["Linus", "Release checklist", "Tag, changelog, then the site."],
  ["Margaret", "Landing", "Trajectory is nominal. Photos in the folder."],
  ["Alan", "Lunch?", "Thursday works. The usual place."],
];

// Each pane spans its share of the window; bleed() keeps its text clear of the strip only on the strip's edge.
const pad: CSSProperties = { paddingTop: "calc(20px + env(safe-area-inset-top))", paddingBottom: 120, ...bleed(20) };
const title: CSSProperties = { font: "700 30px/1.1 -apple-system, system-ui", letterSpacing: -0.4, margin: "0 0 16px" };
const row: CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 4px", border: 0, borderBottom: "0.5px solid var(--line)", background: "none", color: "var(--ink)", font: "400 17px -apple-system, system-ui", textAlign: "left", cursor: "pointer" };
const dim: CSSProperties = { color: "var(--dim)", font: "400 15px/1.4 -apple-system, system-ui", margin: 0 };

export function PanesDemo() {
  const desktop = useDesktop();
  return desktop ? <WebDuo src="/panes" /> : <div className={desktop === null ? "ssr-site" : undefined}><Mail /></div>;
}

function Mail() {
  const nav = usePanes(PATH);
  // Wide: the row that opened the pane beside it stays selected, like a native split view's list.
  const sel = (id: string) => ({ ...row, background: nav.layout === "wide" && PATH.indexOf(nav.at) >= PATH.indexOf(id) ? "var(--line)" : "none" });
  // The pane's own "…": the delete sits last, in red, set apart (blueprint).
  const more: DuetItem[] = [
    { id: "reply", label: "Reply", icon: <Reply size={18} /> },
    { id: "forward", label: "Forward", icon: <Forward size={18} /> },
    { id: "delete", label: "Delete", icon: <Trash2 size={18} />, destructive: true, onPress: nav.close },
  ];
  const bar = <DuetPaneBar onClose={nav.close} onToggle={nav.toggle} expanded={nav.expanded} more={more} />;
  return (
    <Duet primary={{ id: "compose", label: "New message", icon: <SquarePen size={22} />, confirm: false, onPress: () => nav.go("message") }}
      actions={[...(nav.back ? [{ id: "back", label: "Back", icon: <ArrowLeft size={22} />, onPress: nav.back.onPress }] : []), { id: "archive", label: "Archive", icon: <Archive size={22} /> }, { id: "trash", label: "Delete all", icon: <Trash2 size={22} />, destructive: true }]}>
      <DuetPanes path={PATH} at={nav.at} expanded={nav.expanded} panes={{
        mailboxes: (
          <div style={pad}>
            <h1 style={title}>Mailboxes</h1>
            {MAILBOXES.map(([name, icon, n]) => (
              <button key={name} style={name === "Inbox" ? sel("inbox") : row} onClick={() => name === "Inbox" && nav.go("inbox")}>
                <span style={{ color: "var(--accent)", display: "flex" }}>{icon}</span><span style={{ flex: 1 }}>{name}</span>
                {n > 0 && <span style={{ color: "var(--dim)" }}>{n}</span>}<ChevronRight size={18} color="var(--dim)" />
              </button>
            ))}
            <p style={{ ...dim, marginTop: 18 }}>Unfold the device: the inbox slides in beside this list. Fold it again and the same motion plays backwards. Open a message for its pane bar: close, full screen, and a "…" with the delete set apart in red.</p>
          </div>
        ),
        inbox: (
          <div style={pad}>
            <h1 style={title}>Inbox</h1>
            {MAIL.map(([from, subject, body], i) => (
              <button key={from} style={{ ...(i === 0 ? sel("message") : row), display: "block" }} onClick={() => i === 0 && nav.go("message")}>
                <div style={{ fontWeight: 600 }}>{from}</div><div>{subject}</div><p style={{ ...dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{body}</p>
              </button>
            ))}
          </div>
        ),
        message: (<>
          {bar}
          <div style={pad}>
            <p style={dim}>From Ada</p>
            <h1 style={title}>Fold test results</h1>
            <p style={{ ...dim, color: "var(--ink)", fontSize: 17 }}>The hinge held for 200k cycles. Numbers attached.</p>
            <button style={{ ...row, marginTop: 16, borderTop: "0.5px solid var(--line)" }} onClick={() => nav.go("attachment")}>
              <Paperclip size={20} color="var(--accent)" /><span style={{ flex: 1 }}>hinge-cycles.pdf</span><ChevronRight size={18} color="var(--dim)" />
            </button>
            <label style={{ display: "block", marginTop: 24 }}>
              <span style={dim}>Reply. Type something, then fold: the draft stays.</span>
              <textarea name="reply" rows={4} placeholder="Write a reply" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 8, padding: 12, borderRadius: 12, border: "0.5px solid var(--line)", background: "var(--card)", color: "var(--ink)", font: "400 17px -apple-system, system-ui", resize: "vertical" }} />
            </label>
          </div>
        </>),
        attachment: (<>
          {bar}
          <div style={pad}>
            <h1 style={title}>hinge-cycles.pdf</h1>
            <div style={{ aspectRatio: "3 / 4", borderRadius: 14, background: "var(--card)", display: "grid", placeItems: "center", color: "var(--dim)" }}><FileText size={56} /></div>
          </div>
        </>),
      }} />
    </Duet>
  );
}
