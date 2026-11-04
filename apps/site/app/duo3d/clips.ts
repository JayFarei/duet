// The stage's recorded loops: each clip a page on the 3D Duo and the steps it plays once, in `/duo3d?clip=<name>`.
// tools/media records them; e2e/site/site.ts CLIPS lists the same names. A step waits `at` ms after the clip starts,
// then sets the posture, the page or Duet off and on, or presses a control in the page (screen.tsx, `duet:press`).

export type ClipPosture = "closed" | "open" | "laptop" | "sideways";
/** A control to press: a `data-duet-control` kind (the first one), or a CSS selector in the page. */
export type Press = ({ id: string } | { selector: string }) & { retry?: boolean };
export interface Step { at: number; posture?: ClipPosture; src?: string; duet?: boolean; press?: Press }
export interface Clip { src: string; posture: ClipPosture; app?: "safari" | "home" | "sheet"; steps: Step[]; length: number }

const INBOX = "/examples/inbox?plain", CHECKOUT = "/examples/checkout?plain", READER = "/examples/reader?plain";
const web = (url: string) => `/duo3d/web?url=${encodeURIComponent(url)}`;
const cta: Press = { selector: ".duet-row[data-cta]" };

export const CLIPS: Record<string, Clip> = {
  group: { src: INBOX, posture: "open", steps: [], length: 4000 },
  "navigation-tabs": { src: INBOX, posture: "open", steps: [{ at: 1500, press: { selector: '[data-duet-control="navigation"]:nth-of-type(2)' } }], length: 4000 },
  "navigation-tabs-more": { src: INBOX, posture: "laptop", steps: [], length: 4000 },
  "navigation-sidebar": { src: INBOX, posture: "closed", steps: [{ at: 1500, press: { id: "sidebar" } }], length: 4500 },
  more: { src: INBOX, posture: "laptop", steps: [{ at: 1500, press: { id: "more" } }], length: 4500 },
  actions: { src: CHECKOUT, posture: "open", steps: [{ at: 1500, press: { id: "actions" } }], length: 4000 },
  "primary-confirm": { src: CHECKOUT, posture: "open", steps: [{ at: 1500, press: { id: "primary" } }], length: 4500 },
  "primary-direct": { src: READER, posture: "open", steps: [{ at: 1500, press: { id: "primary" } }], length: 4500 },
  "primary-folded": { src: CHECKOUT, posture: "sideways", steps: [{ at: 1500, press: { id: "more" } }, { at: 2700, press: cta }, { at: 3700, press: cta }], length: 5500 },
  close: { src: INBOX, posture: "closed", steps: [{ at: 1500, press: { selector: '[data-testid="inbox-row"]' } }, { at: 3200, press: { id: "close" } }], length: 5000 },
  "pane-bar": { src: READER, posture: "open", steps: [{ at: 1500, press: { selector: '.duet-pane-bar [aria-label="Full screen"]' } }, { at: 3000, press: { selector: '.duet-pane-bar [aria-label="Exit full screen"]' } }], length: 4500 },
  "mode-strip": { src: INBOX, posture: "closed", app: "home", steps: [], length: 3500 },
  "mode-column": { src: INBOX, posture: "closed", steps: [], length: 3500 },
  "mode-inline": { src: INBOX, posture: "closed", app: "sheet", steps: [], length: 3500 },
  "example-inbox": { src: INBOX, posture: "closed", steps: [{ at: 1500, posture: "open" }, { at: 3500, posture: "laptop" }, { at: 5500, posture: "closed" }], length: 7500 },
  "example-checkout": { src: CHECKOUT, posture: "open", steps: [{ at: 1500, press: { id: "primary" } }, { at: 3500, posture: "sideways" }], length: 6000 },
  "example-reader": { src: READER, posture: "closed", steps: [{ at: 1500, posture: "open" }, { at: 3500, press: { selector: '.duet-pane-bar [aria-label="Full screen"]' } }], length: 6000 },
  // Our own apps, on their mock servers only (synthetic data): the recorder checks they answer first.
  "app-regtail": { src: web("http://127.0.0.1:8795/"), posture: "open", steps: [], length: 4000 },
  "app-dashboard": { src: web("http://127.0.0.1:3591/"), posture: "open", steps: [], length: 4000 },
  "app-wealth": { src: web("http://127.0.0.1:8292/"), posture: "open", steps: [], length: 4000 },
};
