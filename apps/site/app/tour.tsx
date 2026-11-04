"use client";

import { useEffect, useState } from "react";
import { Duo } from "./duo/duo";
import type { Scene } from "./duo3d/duo3d";

const INBOX = "/examples/inbox?plain";
const CHECKOUT = "/examples/checkout?plain";
/** The More button while its list is open, in the group Duet shows: pressing it again closes the list. */
const MORE_OPEN = '.duet-group:not([data-leaving]) [data-duet-control="more"][aria-expanded="true"]';

/** The tour, one step per glossary noun: its anchor (#tour-<slug>), caption, one line, and the stage's scene. */
export const STEPS: { slug: string; caption: string; text: string; scene: Scene }[] = [
  { slug: "places", caption: "Places", scene: { src: INBOX, posture: "open", app: "safari" },
    text: "Your app hands Duet its places, here nine folders. On the open Duo the column is long enough for all of them as tabs." },
  { slug: "free-space", caption: "Free space", scene: { src: INBOX, posture: "closed", app: "home" },
    text: "Fold the Duo closed and the column gets short. Duet measures the free space along it before it draws a single button." },
  { slug: "navigation", caption: "Navigation", scene: { src: INBOX, posture: "closed", app: "home" },
    text: "Navigation takes the largest form that fits: Tabs, Tabs + More, or the Sidebar. Here some folders fit as tabs, the rest wait in More." },
  { slug: "more", caption: "More", scene: { src: INBOX, posture: "closed", app: "home", press: { id: "more" }, undo: { selector: MORE_OPEN } },
    text: "More holds what did not fit, under two headings: the remaining Places, then the Actions." },
  { slug: "actions", caption: "Actions + Sidebar", scene: { src: INBOX, posture: "closed", app: "safari" },
    text: "Safari's bars leave even less room, so the folders move into the Sidebar and Compose, Archive and Flag stay out as Actions." },
  { slug: "primary", caption: "Primary", scene: { src: CHECKOUT, posture: "open", app: "safari", press: { id: "primary" } },
    text: "One Primary per page, last in the column. Pay asks to confirm before it runs; a Direct Primary runs on the first press." },
  { slug: "close", caption: "Close, Modes", scene: { src: INBOX, posture: "closed", app: "safari", press: { selector: '[data-testid="inbox-row"]' }, undo: { id: "close" } },
    text: "Open a message and Duet shows only Close. On a wide screen the same controls sit in a Strip, a Column or Inline beside the page." },
];

type Measure = { display: "inner" | "outer"; fit: string | null; free: number };

/** The step whose span holds the middle of the window: before the tour the first, past it the last. */
function current() {
  const mid = innerHeight / 2;
  for (let i = STEPS.length - 1; i >= 0; i--) {
    const el = document.getElementById(`tour-${STEPS[i].slug}`);
    if (el && el.getBoundingClientRect().top <= mid) return i;
  }
  return 0;
}

/** The home tour: one stage that stays on screen (sticky) while seven steps scroll past under it. Each step puts the
 *  live Duo in its scene, and the counters read what the stage's screens measure. */
export function Tour() {
  const [at, setAt] = useState(0);
  const [measured, setMeasured] = useState<Partial<Record<Measure["display"], Measure>>>({});

  useEffect(() => {
    const on = () => setAt(current());
    on();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); };
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
  // A closed Duo shows its outer display, an open one its inner display.
  const shown = step.scene.posture === "closed" || step.scene.posture === "sideways" ? "outer" : "inner";
  const m = measured[shown] ?? measured[shown === "outer" ? "inner" : "outer"];
  const jump = (slug: string) => {
    const el = document.getElementById(`tour-${slug}`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollTo({ top: scrollY + r.top + r.height / 2 - innerHeight / 2, behavior: still ? "auto" : "smooth" });
  };

  return (
    <div className="tour" id="tour">
      {/* data-ready: the stage's screens have sent their first measure (headless Chromium draws the 3D Duo in software
       *  and takes seconds to get there). */}
      <div className="tour-stage" data-testid="tour-stage" data-ready={measured.inner || measured.outer ? "" : undefined}>
        <div className="duo3d">
          <Duo embed chrome={false} idle scene={step.scene} src={INBOX} />
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
            <span data-testid="tour-free">{m ? `free ${m.free} px` : "free … px"}</span>
            <span data-testid="tour-fit">{m ? `fit ${m.fit ?? "none"}` : "fit …"}</span>
          </p>
        </div>
      </div>
      <div className="tour-steps" aria-hidden>
        {STEPS.map((s) => <div key={s.slug} id={`tour-${s.slug}`} className="tour-step" />)}
      </div>
    </div>
  );
}
