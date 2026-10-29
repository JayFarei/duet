"use client";

import { useEffect, useRef, useState } from "react";
import { Duet, isPreview, previewReason, readSignals, settling, useDuet, type Signals } from "duet-ui";
import { Activity, ClipboardCopy, House, RotateCcw } from "lucide-react";

type Range = [number, number];
type Stats = { chrome: Range; column: Range; inset: Range; preview: number };
type Row = { t: string; text: string };

const fresh = (): Stats => ({ chrome: [Infinity, -Infinity], column: [Infinity, -Infinity], inset: [Infinity, -Infinity], preview: 0 });
const grow = ([a, b]: Range, v: number): Range => [Math.min(a, v), Math.max(b, v)];
const span = ([a, b]: Range) => a === Infinity ? "–" : a === b ? `${a}` : `${a} to ${b}`;
const stamp = (t0: number) => `${new Date().toLocaleTimeString("en-GB")} +${((performance.now() - t0) / 1000).toFixed(1)}s`;
const geom = (s: Signals) => `inner ${s.innerWidth}x${s.innerHeight} outer ${s.outerWidth}x${s.outerHeight} visual ${Math.round(s.visualHeight)} inset ${s.insetBottom} angle ${s.angle} scale ${s.scale ?? 1}`;

const TABS = [
  { id: "probe", label: "Probe", icon: <Activity size={22} /> },
  { id: "home", label: "Home", icon: <House size={22} /> },
] as const;

/** Samples readSignals() every 100ms (so transitions between events show too), keeps min and max of the values the
 *  preview rule reads, and logs every change of Duet's verdict and of the geometry. */
export function Probe() {
  const ctx = useDuet();
  const [s, setS] = useState<Signals | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats>(fresh);
  const [log, setLog] = useState<Row[]>([]);
  const t0 = useRef(0), last = useRef({ geom: "", verdict: "", raw: "" });
  const add = (text: string) => setLog((l) => [{ t: stamp(t0.current), text }, ...l].slice(0, 200));

  useEffect(() => {
    const tick = () => {
      const n = readSignals();
      setS(n);
      setBusy(settling());
      setStats((st) => ({
        chrome: grow(st.chrome, n.outerHeight - n.innerHeight), column: grow(st.column, n.outerWidth - n.innerWidth),
        inset: grow(st.inset, n.insetBottom), preview: st.preview + (isPreview(n) ? 1 : 0),
      }));
      const g = geom(n), raw = previewReason(n) ?? "no";
      if (g !== last.current.geom) { last.current.geom = g; add(g); }
      if (raw !== last.current.raw) { last.current.raw = raw; add(`rule: ${raw === "no" ? "not preview" : `PREVIEW (${raw})`}`); }
    };
    tick();
    const id = setInterval(tick, 100);
    const ev = (e: Event) => add(`event ${e.type}${e.type === "pageshow" ? ` persisted=${(e as PageTransitionEvent).persisted}` : e.type === "visibilitychange" ? ` ${document.visibilityState}` : ""}`);
    const types = ["pageshow", "pagehide", "orientationchange"] as const;
    types.forEach((t) => addEventListener(t, ev));
    document.addEventListener("visibilitychange", ev);
    return () => { clearInterval(id); types.forEach((t) => removeEventListener(t, ev)); document.removeEventListener("visibilitychange", ev); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- add only touches state

  useEffect(() => {
    const v = `${ctx.mode} ${ctx.side}${ctx.preview ? " preview" : ""}${ctx.split ? " split" : ""}`;
    if (v !== last.current.verdict) { last.current.verdict = v; add(`DUET: ${v}`); }
  }, [ctx.mode, ctx.side, ctx.preview, ctx.split]); // eslint-disable-line react-hooks/exhaustive-deps

  const reason = s ? previewReason(s) : undefined;
  const copy = () => navigator.clipboard?.writeText(JSON.stringify({ ua: navigator.userAgent, signals: s, stats, log }, null, 1)).then(() => add("copied"), () => add("copy failed"));
  const reset = () => { setStats(fresh()); add("min/max reset"); };
  const cell = { padding: "6px 0", borderBottom: "1px solid var(--line)" } as const;
  const big = { fontSize: 34, fontWeight: 700, margin: "0 0 4px", lineHeight: 1.1 } as const;

  return (
    <>
      <main style={{ padding: "calc(env(safe-area-inset-top) + 20px) calc(var(--duet-inset-right, 0px) + 16px) 160px calc(var(--duet-inset-left, 0px) + 16px)", fontVariantNumeric: "tabular-nums" }}>
        <p style={big} data-testid="mode">{ctx.mode} · {ctx.side}</p>
        <p style={{ ...big, color: ctx.preview ? "#ff3b30" : "var(--ink)" }} data-testid="preview">preview: {ctx.preview ? "YES" : "no"}</p>
        <p style={{ fontSize: 17, margin: "0 0 16px", color: "var(--dim)" }}>
          rule now: {reason ?? "not preview"}{busy ? " · settling" : ""}
        </p>
        {s && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 17 }}>
            <tbody>
              <tr><td style={cell}>inner</td><td style={cell}>{s.innerWidth} x {s.innerHeight}</td></tr>
              <tr><td style={cell}>outer</td><td style={cell}>{s.outerWidth} x {s.outerHeight}</td></tr>
              <tr><td style={cell}>column (outer − inner width)</td><td style={cell}>{s.outerWidth - s.innerWidth}</td></tr>
              <tr><td style={cell}>chrome (outer − inner height)</td><td style={cell}><b>{s.outerHeight - s.innerHeight}</b></td></tr>
              <tr><td style={cell}>inset bottom</td><td style={cell}><b>{s.insetBottom}</b></td></tr>
              <tr><td style={cell}>visual height</td><td style={cell}>{Math.round(s.visualHeight)}</td></tr>
              <tr><td style={cell}>screen</td><td style={cell}>{s.screenWidth} x {s.screenHeight} · angle {s.angle} · {s.pixelRatio}x</td></tr>
              <tr><td style={cell}>standalone · framed</td><td style={cell}>{String(s.standalone)} · {String(s.framed)}</td></tr>
              <tr><td style={cell}>chrome min/max</td><td style={cell}>{span(stats.chrome)}</td></tr>
              <tr><td style={cell}>column min/max</td><td style={cell}>{span(stats.column)}</td></tr>
              <tr><td style={cell}>inset min/max</td><td style={cell}>{span(stats.inset)}</td></tr>
              <tr><td style={cell}>samples read as preview</td><td style={cell}>{stats.preview}</td></tr>
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
          <button onClick={reset} style={btn}><RotateCcw size={16} /> Reset min/max</button>
          <button onClick={copy} style={btn}><ClipboardCopy size={16} /> Copy log</button>
        </div>
        <input placeholder="Tap to open the keyboard" style={{ width: "100%", boxSizing: "border-box", fontSize: 17, padding: 12, borderRadius: 12, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" }} />
        <h2 style={{ fontSize: 22, margin: "24px 0 8px" }}>Log (newest first)</h2>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14, fontFamily: "ui-monospace, Menlo, monospace" }} data-testid="log">
          {log.map((r, i) => <li key={log.length - i} style={{ padding: "4px 0", borderBottom: "1px solid var(--line)", overflowWrap: "anywhere" }}><span style={{ color: "var(--dim)" }}>{r.t}</span> {r.text}</li>)}
        </ol>
        {/* Room to scroll hard, so the URL bar collapses. */}
        {Array.from({ length: 24 }, (_, i) => <div key={i} style={{ height: 120, margin: "12px 0", borderRadius: 16, background: `hsl(${i * 15} 60% 75%)`, display: "flex", alignItems: "center", padding: "0 16px", color: "#000", fontWeight: 600 }}>Scroll filler {i + 1}</div>)}
      </main>
      <Duet menu={{ items: TABS, selected: "probe", onSelect: (id) => { if (id === "home") location.href = "/"; } }} />
    </>
  );
}

const btn = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 16, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" } as const;
