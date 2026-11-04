"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AlertOctagon, Archive, Crown, FileText, Flag, Inbox as InboxIcon, Mail, Send, SquarePen, Trash2 } from "lucide-react";
import { Duet, column, type DuetMenuItem } from "duet-ui";
import { useTheme, useTint } from "../../theme";

// Nine folders: where they all fit Duet shows nine tabs, where some fit those stay tabs and the rest go in More,
// and where fewer than three fit, the Sidebar button opens every folder. Compose is an Action, not a Primary: on the
// closed Duo's band of two buttons a Primary would take the Sidebar button's place (template.ts allocate).
const FOLDERS = [
  { id: "inbox", label: "Inbox", icon: <InboxIcon size={24} /> },
  { id: "vip", label: "VIP", icon: <Crown size={24} /> },
  { id: "flagged", label: "Flagged", icon: <Flag size={24} /> },
  { id: "unread", label: "Unread", icon: <Mail size={24} /> },
  { id: "drafts", label: "Drafts", icon: <FileText size={24} /> },
  { id: "sent", label: "Sent", icon: <Send size={24} /> },
  { id: "archive", label: "Archive", icon: <Archive size={24} /> },
  { id: "junk", label: "Junk", icon: <AlertOctagon size={24} /> },
  { id: "trash", label: "Trash", icon: <Trash2 size={24} /> },
] as const satisfies readonly DuetMenuItem[];
type Folder = (typeof FOLDERS)[number]["id"];

type Letter = { from: string; subject: string; body: string; time: string };
const MAIL: Letter[] = [
  { from: "Ada", subject: "Hinge test results", body: "The hinge held for 200k cycles. The full log is in the shared folder, with photos of the last run.", time: "9:41" },
  { from: "Grace", subject: "Two panes or a sheet?", body: "Two panes beside the controls read better than a sheet over the list. Can we try it on the open screen first?", time: "9:12" },
  { from: "Linus", subject: "Release checklist", body: "Tag, changelog, then the site. The changelog is drafted; tagging after lunch.", time: "8:30" },
  { from: "Margaret", subject: "Landing photos", body: "Everything nominal. The photos are in the folder, sorted by time.", time: "Yesterday" },
  { from: "Alan", subject: "Lunch on Thursday?", body: "Thursday works for me. The usual place at noon?", time: "Yesterday" },
  { from: "Barbara", subject: "Column spacing", body: "Eleven points between groups, the same as the rail. I updated the spec.", time: "Mon" },
  { from: "Ken", subject: "Old prototype", body: "The first column build, for the record. It still runs.", time: "Sun" },
  { from: "Dennis", subject: "Kickoff notes", body: "Notes from the first meeting, with the open questions at the end.", time: "Sat" },
];

const page: CSSProperties = { minHeight: "100dvh", background: "var(--bg)", color: "var(--ink)", font: "400 17px -apple-system, system-ui" };
const title: CSSProperties = { font: "700 32px/1.1 -apple-system, system-ui", letterSpacing: -0.4, margin: "0 0 12px" };
const row: CSSProperties = { display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 12px", width: "100%", padding: "12px 0", border: 0, borderBottom: "0.5px solid var(--line)", background: "none", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer" };
const dim: CSSProperties = { color: "var(--dim)", font: "400 15px/1.35 -apple-system, system-ui" };

export function InboxApp() {
  const { appearance } = useTheme();
  const { tint } = useTint();
  const [folder, setFolder] = useState<Folder>("inbox");
  const [open, setOpen] = useState<Letter | null>(null);
  const [duet, setDuet] = useState(true);
  const name = FOLDERS.find((f) => f.id === folder)!.label;
  const mail = folder === "inbox" ? MAIL : MAIL.filter((_, i) => (i + FOLDERS.findIndex((f) => f.id === folder)) % 3 === 0);

  // The site's 3D Duo turns Duet off and on and picks a folder for its Moments.
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.type !== "skeleton:duet") return;
      setDuet(e.data.on !== false);
      if (FOLDERS.some((f) => f.id === e.data.selected?.id)) setFolder(e.data.selected.id);
    };
    addEventListener("message", on);
    if (parent !== window) parent.postMessage({ type: "skeleton:ready" }, location.origin);
    return () => removeEventListener("message", on);
  }, []);

  const list = (
    <main style={{ ...column(720), paddingTop: "calc(24px + env(safe-area-inset-top))", paddingBottom: 120 }}>
      <h1 style={title}>{name}</h1>
      {mail.map((m) => (
        <button key={m.subject} data-testid="inbox-row" style={row} onClick={() => setOpen(m)}>
          <strong style={{ fontWeight: 600 }}>{m.from}</strong><span style={dim}>{m.time}</span>
          <span style={{ gridColumn: "1 / -1" }}>{m.subject}</span>
          <span style={{ ...dim, gridColumn: "1 / -1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.body}</span>
        </button>
      ))}
    </main>
  );

  // A message opens in a sheet over the list: while it is up, Duet's controls are just Close.
  const sheet = open && (
    <div role="dialog" aria-label={open.subject} style={{ position: "fixed", inset: 0, zIndex: 20, background: "var(--bg)", overflow: "auto" }}>
      <article style={{ ...column(720), paddingTop: "calc(24px + env(safe-area-inset-top))", paddingBottom: 120 }}>
        <p style={dim}>From {open.from}, {open.time}</p>
        <h2 style={title}>{open.subject}</h2>
        <p style={{ lineHeight: 1.5 }}>{open.body}</p>
      </article>
    </div>
  );

  if (!duet) return <div style={page}>{list}{sheet}</div>;
  return (
    <Duet
      menu={open ? undefined : { items: [...FOLDERS], selected: folder, onSelect: setFolder, tabs: true }}
      actions={open ? undefined : [
        { id: "compose", label: "Compose", icon: <SquarePen size={22} />, onPress: () => setOpen({ from: "You", subject: "New message", body: "", time: "Now" }) },
        { id: "archive", label: "Archive", icon: <Archive size={22} /> },
        { id: "flag", label: "Flag", icon: <Flag size={22} /> },
        { id: "delete", label: "Delete", icon: <Trash2 size={22} />, destructive: true, folded: true },
      ]}
      close={open ? { label: "Close", onPress: () => setOpen(null) } : false}
      appearance={appearance}
      tint={tint}
    >
      <div style={page}>{list}{sheet}</div>
    </Duet>
  );
}
