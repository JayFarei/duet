"use client";
import { useEffect, useState } from "react";
import { Duet, DuetPaneBar, column, useDuet } from "duet-ui";

// Deliberately small, network-free consumer for browser contracts and visual review.
export function QualityFixture() {
  const ctx = useDuet();
  const [selected, setSelected] = useState("home");
  const [calls, setCalls] = useState(0);
  const [documentScroll, setDocumentScroll] = useState(false);
  useEffect(() => setDocumentScroll(new URLSearchParams(location.search).has("document")), []);
  const content = <main style={{ ...column(680, 20), paddingTop: 24, paddingBottom: 32, color: "#111827", background: "#fff" }}>
    <h1 style={{ fontSize: 28 }}>Duet quality fixture</h1>
    <p>Navigation and drafts survive a fold or a turn.</p>
    <label>Draft <input aria-label="Draft" defaultValue="" /></label>
    <output aria-label="Navigation calls">{calls}</output>
    <p data-testid="context">{ctx.mode} / {ctx.layout}{ctx.keyboard ? " / keyboard" : ""}</p>
    <DuetPaneBar more={[{ id: "save", label: "Save", icon: null }, { id: "delete", label: "Delete", icon: null, destructive: true }]} />
    {Array.from({ length: 12 }, (_, i) => <section key={i} style={{ minHeight: 120 }}><h2>Section {i + 1}</h2><p>Keep readable content beside the controls.</p></section>)}
  </main>;
  const props = { menu: { items: [{ id: "home", label: "Home" }, { id: "journey", label: "Journey" }], selected, onSelect: (id: string) => { setSelected(id); setCalls((n) => n + 1); } }, actions: [{ id: "share", label: "Share", icon: <span aria-hidden>↑</span> }, { id: "delete", label: "Delete page", icon: null, destructive: true }] };
  return <div style={{ width: ctx.width, fontFamily: "Arial, sans-serif", background: "#fff" }}>
    <Duet {...props}>{documentScroll ? undefined : content}</Duet>
    {documentScroll && content}
  </div>;
}
