"use client";

import { useState } from "react";
import { Bell, Bookmark, Check, CreditCard, Home, Pencil, Plus, Share, Trash2 } from "lucide-react";
import { Duet, useDuet, type DuetItem, type DuetPrimary } from "duet-ui";

// Each scenario is the smallest app that reaches one fixed bug. The counter's pointerdown always arrives; its click
// only arrives when Duet lets the tap through, so taps minus clicks is the number of swallowed taps.
const SCENARIOS = {
  gone: "#262: a \"…\" row removes \"…\"",
  dismiss: "#253a: tap outside an open \"…\"",
  confirm: "Primary confirm box",
} as const;
type Scenario = keyof typeof SCENARIOS;

const ICONS = [Bell, Share, Bookmark, Pencil, Trash2];
const NAMES = ["Alerts", "Share", "Save", "Edit", "Delete"];

export function Qa() {
  const ctx = useDuet();
  const [scenario, setScenario] = useState<Scenario>("gone");
  const [busy, setBusy] = useState(true);
  const [taps, setTaps] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [last, setLast] = useState("");
  const reset = (s = scenario) => { setScenario(s); setBusy(true); setTaps(0); setClicks(0); setLast(""); };

  let actions: DuetItem[] = [];
  let primary: DuetPrimary | undefined;
  if (scenario === "gone") {
    actions = [
      { id: "credits", label: "Credits", icon: <CreditCard size={22} />, onPress: () => setLast("Credits") },
      ...(busy ? [{ id: "new", label: "New check", icon: <Plus size={22} />, folded: true, onPress: () => { setBusy(false); setLast("New check"); } }] : []),
    ];
    primary = busy ? { id: "check", label: "Check", icon: <Check size={22} />, confirm: false, onPress: () => setLast("Check") } : undefined;
  } else if (scenario === "dismiss") {
    actions = NAMES.map((n, i) => { const I = ICONS[i]; return { id: n, label: n, icon: <I size={22} />, onPress: () => setLast(n) }; });
  } else {
    actions = [{ id: "share", label: "Share", icon: <Share size={22} />, onPress: () => setLast("Share") }];
    primary = { id: "book", label: "Book", confirm: "Book it", icon: <Check size={22} />, onPress: () => setLast("Book ran") };
  }

  const swallowed = taps - clicks;
  return (
    <div style={{ minHeight: "100vh", background: "rgb(237 240 245)", color: "#000", font: "16px -apple-system, system-ui" }}>
      <style>{"html,body{margin:0;background:rgb(237 240 245)}"}</style>
      <Duet
        menu={{ items: [{ id: "home", label: "Home", icon: <Home size={22} /> }], selected: "home", onSelect: () => setLast("Home") }}
        actions={actions}
        primary={primary}
      >
        <div style={{ padding: "calc(16px + var(--duet-inset-top, 0px)) 20px 120px", display: "grid", gap: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            mode {ctx.mode} · side {ctx.side}{ctx.hidden ? ` · hidden ${ctx.hidden}` : ""} · {ctx.width}x{ctx.height}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(SCENARIOS) as Scenario[]).map((s) => (
              <button key={s} onClick={() => reset(s)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #c6c6c8", background: s === scenario ? "#0088ff" : "#fff", color: s === scenario ? "#fff" : "#000", font: "inherit", fontSize: 14 }}>
                {SCENARIOS[s]}
              </button>
            ))}
          </div>
          <button
            id="target"
            onPointerDown={() => setTaps((n) => n + 1)}
            onClick={() => setClicks((n) => n + 1)}
            style={{ height: 180, borderRadius: 20, border: "none", background: swallowed > 0 ? "#ffd60a" : "#fff", font: "inherit", touchAction: "manipulation" }}
          >
            <div style={{ fontSize: 22, fontWeight: 600 }}>Tap me</div>
            <div style={{ marginTop: 8 }}>taps {taps} · clicks {clicks} · swallowed {swallowed}</div>
          </button>
          <div>Last control: <b id="last">{last || "none"}</b></div>
          <button onClick={() => reset()} style={{ padding: 12, borderRadius: 12, border: "1px solid #c6c6c8", background: "#fff", font: "inherit" }}>
            Reset this scenario
          </button>
        </div>
      </Duet>
    </div>
  );
}
