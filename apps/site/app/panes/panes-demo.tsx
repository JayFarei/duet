"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Archive, ArrowLeft, ChevronRight, FileText, Forward, Inbox, Paperclip, Reply, Send, SquarePen, Star, Trash2 } from "lucide-react";
import { Duet, DuetPaneBar, DuetPanes, bleed, usePanes, type DuetItem } from "duet-ui";
import { WebDuo, useDesktop } from "../duo/web-duo";

const PATH = ["mailboxes", "inbox", "message", "attachment"];
const MAILBOXES: [string, ReactNode][] = [["Inbox", <Inbox size={20} />], ["Starred", <Star size={20} />], ["Sent", <Send size={20} />], ["Archive", <Archive size={20} />], ["Trash", <Trash2 size={20} />]];
// [from, subject, body, attachment]: every mailbox has its own mail, every mail opens.
type Letter = [string, string, string, string?];
const MAIL: Record<string, Letter[]> = {
  Inbox: [
    ["Ada", "Fold test results", "The hinge held for 200k cycles. Numbers attached.", "hinge-cycles.pdf"],
    ["Grace", "Split view notes", "Two panes beside the strip read better than a modal."],
    ["Linus", "Release checklist", "Tag, changelog, then the site.", "checklist.txt"],
    ["Margaret", "Landing", "Trajectory is nominal. Photos in the folder."],
    ["Alan", "Lunch?", "Thursday works. The usual place."],
  ],
  Starred: [
    ["Ada", "Fold test results", "The hinge held for 200k cycles. Numbers attached.", "hinge-cycles.pdf"],
    ["Barbara", "Column spacing", "Eleven points between groups, same as the rail."],
  ],
  Sent: [
    ["To Grace", "Re: Split view notes", "Agreed. The list stays selected while the pane is open."],
    ["To Ada", "Hinge numbers", "Can you share the raw cycle log?"],
    ["To Linus", "Re: Release checklist", "Changelog is drafted, tagging after lunch."],
  ],
  Archive: [
    ["Ken", "Old prototype", "The first column build, for the record.", "prototype.mov"],
    ["Dennis", "Kickoff", "Notes from the first meeting."],
  ],
  Trash: [
    ["Newsletter", "This week in folds", "Five hinges you should know about."],
  ],
};

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
  const [box, setBox] = useState("Inbox");
  const [pick, setPick] = useState(0);
  const mails = MAIL[box];
  const [from, subject, body, file] = mails[pick] ?? mails[0];
  // Wide: the row that opened the pane beside it stays selected, like a native split view's list.
  const sel = (id: string, on: boolean) => ({ ...row, background: on && nav.layout === "wide" && PATH.indexOf(nav.at) >= PATH.indexOf(id) ? "var(--line)" : "none" });
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
            {MAILBOXES.map(([name, icon]) => (
              <button key={name} style={sel("inbox", name === box)} onClick={() => { setBox(name); setPick(0); nav.go("inbox"); }}>
                <span style={{ color: "var(--accent)", display: "flex" }}>{icon}</span><span style={{ flex: 1 }}>{name}</span>
                <span style={{ color: "var(--dim)" }}>{MAIL[name].length}</span><ChevronRight size={18} color="var(--dim)" />
              </button>
            ))}
            <p style={{ ...dim, marginTop: 18 }}>Unfold the device: the inbox slides in beside this list. Fold it again and the same motion plays backwards. Open a message for its pane bar: close, full screen, and a "…" with the delete set apart in red.</p>
          </div>
        ),
        inbox: (
          <div style={pad}>
            <h1 style={title}>{box}</h1>
            {mails.map(([from, subject, body], i) => (
              <button key={subject} style={{ ...sel("message", i === pick), display: "block" }} onClick={() => { setPick(i); nav.go("message"); }}>
                <div style={{ fontWeight: 600 }}>{from}</div><div>{subject}</div><p style={{ ...dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{body}</p>
              </button>
            ))}
          </div>
        ),
        message: (<>
          {bar}
          <div style={pad}>
            <p style={dim}>{from.startsWith("To ") ? from : `From ${from}`}</p>
            <h1 style={title}>{subject}</h1>
            <p style={{ ...dim, color: "var(--ink)", fontSize: 17 }}>{body}</p>
            {file && <button style={{ ...row, marginTop: 16, borderTop: "0.5px solid var(--line)" }} onClick={() => nav.go("attachment")}>
              <Paperclip size={20} color="var(--accent)" /><span style={{ flex: 1 }}>{file}</span><ChevronRight size={18} color="var(--dim)" />
            </button>}
            <label style={{ display: "block", marginTop: 24 }}>
              <span style={dim}>Reply. Type something, then fold: the draft stays.</span>
              <textarea key={box + pick} name="reply" rows={4} placeholder="Write a reply" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 8, padding: 12, borderRadius: 12, border: "0.5px solid var(--line)", background: "var(--card)", color: "var(--ink)", font: "400 17px -apple-system, system-ui", resize: "vertical" }} />
            </label>
          </div>
        </>),
        attachment: (<>
          {bar}
          <div style={pad}>
            <h1 style={title}>{file}</h1>
            <div style={{ aspectRatio: "3 / 4", borderRadius: 14, background: "var(--card)", display: "grid", placeItems: "center", color: "var(--dim)" }}><FileText size={56} /></div>
          </div>
        </>),
      }} />
    </Duet>
  );
}
