"use client";

import { useState, type CSSProperties } from "react";
import { ArrowLeft, Bookmark, BookOpen, ChevronRight, Type } from "lucide-react";
import { Duet, DuetPaneBar, DuetPanes, bleed, usePanes } from "duet-ui";
import { useTheme, useTint } from "../../theme";

// Two panes, the library and the open book: folded one shows at a time, unfolded they sit side by side. The book's
// Pane bar closes it or takes it full screen. Next book is the Primary with no confirm box: it runs at once.
const PATH = ["library", "book"];
const BOOKS = [
  { id: "hinge", title: "The Hinge", author: "A. Lovelace", pages: ["A fold is a promise that two halves will meet again.", "The first prototype opened two hundred thousand times before the hinge gave a single degree.", "What it taught us was patience: every layout has to survive the fold."] },
  { id: "column", title: "A Column of Light", author: "G. Hopper", pages: ["The controls stood in a column beside the page, out of the way of the reading.", "Each group took only the room it needed, and gave the rest back."] },
  { id: "panes", title: "Two Panes", author: "L. Torvalds", pages: ["One pane on the cover, two inside: the same book, laid out for the room it has.", "The list stayed where it was, and the page slid in beside it."] },
];

const pad: CSSProperties = { paddingTop: "calc(24px + env(safe-area-inset-top))", paddingBottom: 120, ...bleed(20) };
const title: CSSProperties = { font: "700 32px/1.1 -apple-system, system-ui", letterSpacing: -0.4, margin: "0 0 12px" };
const row: CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 0", border: 0, borderBottom: "0.5px solid var(--line)", background: "none", color: "var(--ink)", font: "400 17px -apple-system, system-ui", textAlign: "left", cursor: "pointer" };
const dim: CSSProperties = { color: "var(--dim)", font: "400 15px/1.35 -apple-system, system-ui" };

export function ReaderApp() {
  const { appearance } = useTheme();
  const { tint } = useTint();
  const nav = usePanes(PATH, "book");
  const [pick, setPick] = useState(0);
  const [large, setLarge] = useState(false);
  const book = BOOKS[pick];

  return (
    <Duet
      actions={[
        ...(nav.back ? [{ id: "back", label: "Back", icon: <ArrowLeft size={22} />, onPress: nav.back.onPress }] : []),
        { id: "bookmark", label: "Bookmark", icon: <Bookmark size={22} /> },
        { id: "size", label: large ? "Smaller text" : "Larger text", icon: <Type size={22} />, onPress: () => setLarge((l) => !l) },
      ]}
      primary={{ id: "next", label: "Next book", icon: <BookOpen size={22} />, confirm: false, onPress: () => { setPick((i) => (i + 1) % BOOKS.length); nav.go("book"); } }}
      appearance={appearance}
      tint={tint}
    >
      <div style={{ background: "var(--bg)", color: "var(--ink)", minHeight: "100dvh" }}>
        <DuetPanes path={PATH} at={nav.at} expanded={nav.expanded} panes={{
          library: (
            <div style={pad}>
              <h1 style={title}>Library</h1>
              {BOOKS.map((b, i) => (
                <button key={b.id} style={{ ...row, fontWeight: i === pick && nav.at === "book" ? 600 : 400 }} onClick={() => { setPick(i); nav.go("book"); }}>
                  <span style={{ flex: 1 }}>{b.title}<br /><span style={dim}>{b.author}</span></span><ChevronRight size={18} color="var(--dim)" />
                </button>
              ))}
            </div>
          ),
          book: (
            <div data-pane-full={nav.expanded || undefined}>
              <DuetPaneBar onClose={nav.close} onToggle={nav.toggle} expanded={nav.expanded} />
              <article style={pad}>
                <p style={dim}>{book.author}</p>
                <h1 style={title}>{book.title}</h1>
                {book.pages.map((p) => <p key={p} style={{ font: `400 ${large ? 22 : 18}px/1.6 Georgia, serif`, margin: "0 0 1em" }}>{p}</p>)}
              </article>
            </div>
          ),
        }} />
      </div>
    </Duet>
  );
}
