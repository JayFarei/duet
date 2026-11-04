"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Duo } from "./duo/duo";
import type { Scene } from "./duo3d/duo3d";
import { MORE_OPEN } from "./duo3d/clips";
import { LoopVideo } from "./loop-video";

const INBOX = "/examples/inbox?plain";
const CHECKOUT = "/examples/checkout?plain";
const ROW = { selector: '[data-testid="inbox-row"]' };

/** The phase of a step the scroll has reached: the first of `n` while p is under 1/n, and so on. */
const phase = (p: number, n: number) => Math.min(n - 1, Math.floor(p * n));
/** The hinge over the Free space step: flat while the step comes in, closed by its last third. */
const unfold = (p: number) => 1 - Math.max(0, Math.min(1, (p - 0.1) / 0.55));

type Step = {
  slug: string; caption: string; text: string;
  /** The stage's scene at p, how far the scroll is through the step (0 to 1; 1 under reduced motion). */
  scene: (p: number) => Scene;
  /** For a step the scroll drives frame by frame: the hinge at p. */
  fold?: (p: number) => number;
  /** The recorded loop shown in the stage's place without WebGL 2. */
  clip: string;
};

/** The tour, one step per glossary noun: its anchor (#tour-<slug>), caption, one line, and the stage's scene. */
export const STEPS: Step[] = [
  { slug: "places", caption: "Places", clip: "navigation-tabs",
    scene: () => ({ src: INBOX, posture: "open", app: "safari", highlight: "places" }),
    text: "Your app hands Duet its places, here nine folders. On the open Duo the column is long enough for all of them as tabs." },
  { slug: "free-space", caption: "Free space", clip: "navigation-tabs-more",
    scene: (p) => unfold(p) >= 0.5 ? { src: INBOX, posture: "open", app: "safari", highlight: "column" } : { src: INBOX, posture: "closed", app: "home", highlight: "column" },
    fold: unfold,
    text: "Fold the Duo closed and the column gets short. Duet measures its length, the free space, before it draws a single button." },
  { slug: "navigation", caption: "Navigation", clip: "navigation-sidebar",
    scene: (p) => [
      { src: INBOX, posture: "open", app: "safari" },
      { src: INBOX, posture: "closed", app: "home" },
      { src: INBOX, posture: "closed", app: "safari" },
    ][p < 0.25 ? 0 : p < 0.75 ? 1 : 2] as Scene,
    text: "Navigation takes the largest form that fits: Tabs open, Tabs + More folded, the Sidebar once Safari's bars take their share." },
  { slug: "more", caption: "More", clip: "more",
    scene: () => ({ src: INBOX, posture: "closed", app: "home", press: { id: "more" }, undo: { selector: MORE_OPEN } }),
    text: "More holds what did not fit, under two headings: the remaining Places, then the Actions." },
  { slug: "actions", caption: "Actions + Sidebar", clip: "actions",
    scene: () => ({ src: INBOX, posture: "closed", app: "safari" }),
    text: "Safari's own bars leave room for two buttons, so the folders move into the Sidebar and the Actions, Compose, Archive, Flag and Delete, wait in More." },
  { slug: "primary", caption: "Primary", clip: "primary-confirm",
    scene: () => ({ src: CHECKOUT, posture: "open", app: "safari", press: { id: "primary" } }),
    text: "One Primary per page, last in the column. Pay asks to confirm before it runs; a Direct Primary runs on the first press." },
  { slug: "close", caption: "Close", clip: "close",
    scene: () => ({ src: INBOX, posture: "closed", app: "safari", press: ROW, undo: { id: "close" } }),
    text: "Open a message and Duet shows only Close, where the other controls were." },
  { slug: "modes", caption: "Modes", clip: "mode-column",
    scene: (p) => ({ src: INBOX, posture: "closed", app: (["home", "safari", "sheet"] as const)[phase(p, 3)] }),
    text: "Where the controls go: a Strip beside a Home Screen app, the Column in Safari, Inline in the page everywhere else." },
];

type Measure = { display: "inner" | "outer"; fit: string | null; length?: number; free: number; mode?: string | null };
const FITS: Record<string, string> = { tabs: "Tabs", "tabs-more": "Tabs + More", sidebar: "Sidebar" };
const MODES: Record<string, string> = { strip: "Strip", column: "Column", inline: "Inline" };

/** The step whose span holds the middle of the window (before the tour the first, past it the last), and how far
 *  through it the middle is, to a hundredth. */
function current() {
  const mid = innerHeight / 2;
  for (let i = STEPS.length - 1; i >= 0; i--) {
    const el = document.getElementById(`tour-${STEPS[i].slug}`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.top <= mid || i === 0) return { at: i, p: Math.round(Math.max(0, Math.min(1, (mid - r.top) / r.height)) * 100) / 100 };
  }
  return { at: 0, p: 0 };
}

/** The home tour: one stage that stays on screen (sticky) while the steps scroll past under it. Each step puts the
 *  live Duo in its scene, some move it with the scroll (the fold, the three fits, the three modes), and the meters read
 *  what the stage's screens measure. */
export function Tour({ clips = {} }: { clips?: Record<string, boolean> }) {
  const [{ at, p: raw }, setPos] = useState({ at: 0, p: 0 });
  const [still, setStill] = useState(false);
  const [measured, setMeasured] = useState<Partial<Record<Measure["display"], Measure>>>({});

  useEffect(() => {
    const calm = matchMedia("(prefers-reduced-motion: reduce)");
    setStill(calm.matches);
    const on = () => setPos((was) => { const n = current(); return n.at === was.at && n.p === was.p ? was : n; });
    const motion = () => setStill(calm.matches);
    on();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    calm.addEventListener("change", motion);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); calm.removeEventListener("change", motion); };
  }, []);

  useEffect(() => {
    const on = (e: Event) => {
      const m = (e as CustomEvent<Measure>).detail;
      if (m?.display) setMeasured((all) => ({ ...all, [m.display]: m }));
    };
    addEventListener("duet:measure", on);
    return () => removeEventListener("duet:measure", on);
  }, []);

  const step = STEPS[at];
  // Under reduced motion a step shows its end state at once.
  const p = still ? 1 : raw;
  const scene = step.scene(p);
  const fold = step.fold?.(p);
  // A closed Duo shows its outer display, an open one its inner display.
  const shown = scene.posture === "closed" || scene.posture === "sideways" ? "outer" : "inner";
  const m = measured[shown] ?? measured[shown === "outer" ? "inner" : "outer"];
  const jump = (slug: string) => {
    const el = document.getElementById(`tour-${slug}`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    scrollTo({ top: scrollY + r.top + r.height / 2 - innerHeight / 2, behavior: still ? "auto" : "smooth" });
  };
  const fit = m?.fit ? FITS[m.fit] : undefined, mode = m?.mode ? MODES[m.mode] : undefined;

  return (
    <div className="tour" id="tour">
      {/* data-ready: the stage's screens have sent their first measure (headless Chromium draws the 3D Duo in software
       *  and takes seconds to get there). --p: how far through the step, for the current tick's bar. */}
      <div className="tour-stage" data-testid="tour-stage" data-ready={measured.inner || measured.outer ? "" : undefined} style={{ "--p": p } as CSSProperties}>
        <div className="duo3d">
          <Duo embed chrome={false} idle scene={scene} fold={fold} src={INBOX}
            fallback={<LoopVideo name={step.clip} available={!!clips[step.clip]} label={`${step.caption} on the iPhone Duo`} />} />
        </div>
        <div className="tour-side">
          <ol className="tour-ticks" aria-label="Tour">
            {STEPS.map((s, i) => (
              <li key={s.slug}>
                <button type="button" data-testid="tour-tick" aria-current={i === at ? "step" : undefined} onClick={() => jump(s.slug)}>{s.caption}</button>
              </li>
            ))}
          </ol>
          <p className="tour-caption" data-testid="tour-caption" aria-live="polite">{step.caption}</p>
          <p className="tour-text">{step.text}</p>
          <p className="tour-meters" aria-label="Measured on the stage">
            {/* A display mid-turn or mid-fold reports a 0 long column: wait for the next real measure. */}
            <span data-testid="tour-free">{m?.length ? `Free space ${m.length} px` : "Free space … px"}</span>
            <span data-testid="tour-left">{m?.length ? `Left over ${m.free} px` : "Left over … px"}</span>
            {fit && !!m?.length && <span data-testid="tour-fit">Navigation {fit}</span>}
            {step.slug === "modes" && mode && <span data-testid="tour-mode">Mode {mode}</span>}
          </p>
        </div>
      </div>
      <div className="tour-steps" aria-hidden>
        {STEPS.map((s) => <div key={s.slug} id={`tour-${s.slug}`} className="tour-step" />)}
      </div>
    </div>
  );
}
