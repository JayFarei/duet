"use client";

import { useEffect, useRef, useState, type DetailedHTMLProps, type HTMLAttributes } from "react";

// Unfold (MIT, Toli Marchuk, github.com/tolimarchuk/unfold-duo) draws the iPhone Duo in CSS 3D. It is self-hosted in
// public/vendor and loaded as a plain module script, so it never goes through the bundler or a CDN.
type UnfoldDevice = HTMLElement & {
  setPosture(name: string, options?: { duration?: number }): Promise<unknown>;
  setScreen(name: "inner" | "cover", src: string | null): void;
};

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "unfold-device": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { inner?: string; cover?: string; posture?: string; finish?: string; label?: string };
    }
  }
}

const SHOT = { closed: "/hero/closed-column.webp", open: "/hero/open-inline.webp", split: "/hero/split.webp" };

/** The fold story, one step per mode change. Each still is the real site, captured from the web Duo below. */
const STEPS: { id: string; label: string; text: string; hold: number; go: (d: UnfoldDevice) => void }[] = [
  { id: "closed", label: "Closed", hold: 3600, text: "Closed, in a Safari tab. Safari leaves a column beside the page, so Duet paints its controls there: column mode.",
    go: (d) => { d.setPosture("closed"); d.setScreen("inner", SHOT.open); } },
  { id: "opening", label: "Opening", hold: 1800, text: "Unfolding. The window grows to the full inner screen and Duet follows the new size.",
    go: (d) => { d.setPosture("landscape-ajar", { duration: 1600 }); } },
  { id: "open", label: "Open", hold: 3600, text: "Open at full width. Safari has no column now, so Duet keeps an 84pt strip inside the page: inline mode.",
    go: (d) => { d.setPosture("landscape"); } },
  { id: "split", label: "Split View", hold: 3600, text: "In Split View, Safari's pane gets its column back, and Duet moves the controls into it: column mode again.",
    go: (d) => { d.setScreen("inner", SHOT.split); } },
];

let loading: Promise<void> | undefined;
function loadUnfold() {
  if (customElements.get("unfold-device")) return Promise.resolve();
  return (loading ||= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.type = "module";
    s.src = "/vendor/unfold.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("unfold.js failed to load"));
    document.head.append(s);
  }));
}

/** The desktop hero: an Unfold iPhone Duo that folds and splits through Duet's modes, with a caption per step. */
export function UnfoldHero() {
  const ref = useRef<UnfoldDevice>(null);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => { loadUnfold().then(() => setReady(true), () => {}); }, []);

  useEffect(() => {
    const d = ref.current;
    if (!ready || !d) return;
    STEPS[step].go(d);
    if (paused) return;
    const t = setTimeout(() => setStep((step + 1) % STEPS.length), STEPS[step].hold);
    return () => clearTimeout(t);
  }, [ready, step, paused]);

  return (
    <section data-hero style={{ minHeight: "92dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: "40px 16px 8px", boxSizing: "border-box" }}>
      <header style={{ textAlign: "center" }}>
        <img src="/icon-512.png" alt="" width={64} height={64} style={{ borderRadius: 15 }} />
        <h1 style={{ font: "800 44px/1 -apple-system, system-ui", letterSpacing: -1.1, margin: "12px 0 8px" }}>Duet</h1>
        <p style={{ color: "var(--dim)", font: "400 18px/1.45 -apple-system, system-ui", margin: 0, maxWidth: 520 }}>
          Native-feeling controls for React web apps on the foldable iPhone. Fold it, and the controls follow.
        </p>
      </header>
      <unfold-device ref={ref} posture="closed" finish="night-sky" cover={SHOT.closed} inner={SHOT.open}
        label="iPhone Duo showing the Duet site" style={{ width: "min(860px, 100%)" }} />
      <div role="tablist" aria-label="Fold story" style={{ display: "flex", gap: 4, padding: 3, borderRadius: 12, background: "var(--line)" }}>
        {STEPS.map((s, i) => (
          <button key={s.id} role="tab" aria-selected={step === i} onClick={() => { setPaused(true); setStep(i); }}
            style={{ height: 32, padding: "0 14px", border: 0, borderRadius: 9, cursor: "pointer", font: "600 14px -apple-system, system-ui", color: "var(--ink)", background: step === i ? "var(--card)" : "transparent" }}>
            {s.label}
          </button>
        ))}
        <button aria-label={paused ? "Play" : "Pause"} onClick={() => setPaused(!paused)}
          style={{ width: 32, height: 32, border: 0, borderRadius: 9, cursor: "pointer", color: "var(--ink)", background: "transparent", font: "600 14px -apple-system, system-ui" }}>
          {paused ? "▶" : "❙❙"}
        </button>
      </div>
      <p data-hero-caption aria-live="polite" style={{ margin: 0, maxWidth: 560, minHeight: 44, textAlign: "center", color: "var(--dim)", font: "400 15px/1.45 -apple-system, system-ui" }}>
        {STEPS[step].text}
      </p>
    </section>
  );
}
