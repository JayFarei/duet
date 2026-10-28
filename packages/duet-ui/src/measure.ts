// The browser signals detect() works from, read from the window. No module state or listeners, so the pre-paint boot
// (boot.ts) can bundle it without signals.ts.
import type { Signals } from "./geometry.ts";

/** A text field has focus (`:read-write`, as the column's focus rule in duet.css: inputs that take text, textareas,
 *  contenteditable), or a select or an iframe, which open a picker or may hold a field. Through shadow roots. */
function editing() {
  let e = document.activeElement;
  while (e?.shadowRoot?.activeElement) e = e.shadowRoot.activeElement;
  return !!e?.matches(":read-write, select, iframe");
}

/** probe: an element padded by env(safe-area-inset-*), for the insets; without one they read 0. Browser only. */
export function measure(probe?: Element): Signals {
  const pad = probe ? getComputedStyle(probe) : undefined;
  const inset = (v: string | undefined) => parseFloat(v ?? "") || 0;
  return {
    innerWidth: innerWidth,
    innerHeight: innerHeight,
    outerWidth: outerWidth,
    outerHeight: outerHeight,
    visualHeight: visualViewport?.height ?? innerHeight,
    insetTop: inset(pad?.paddingTop),
    insetBottom: inset(pad?.paddingBottom),
    screenWidth: innerWidth > innerHeight ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height),
    screenHeight: innerWidth > innerHeight ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height),
    insetRight: inset(pad?.paddingRight),
    insetLeft: inset(pad?.paddingLeft),
    framed: window.top !== window,
    pixelRatio: devicePixelRatio,
    userAgent: navigator.userAgent,
    touchPoints: navigator.maxTouchPoints,
    angle: screen.orientation?.angle ?? ((((window as Window & { orientation?: number }).orientation ?? 0) + 360) % 360),
    standalone: (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches,
    scale: visualViewport?.scale ?? 1,
    canGoForward: (window as Window & { navigation?: { canGoForward?: boolean } }).navigation?.canGoForward === true,
    editing: editing(),
  };
}
