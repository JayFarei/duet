"use client";

import { useSyncExternalStore } from "react";

// The site follows the system light/dark setting unless the visitor picks the other one. The pick lives in
// localStorage, so the stage's iframe (same origin) follows it too, and layout.tsx applies it before first paint.
const THEME_KEY = "duet-theme";
const mq = () => matchMedia("(prefers-color-scheme: dark)");
const stored = (): "light" | "dark" | null => {
  try { const v = localStorage.getItem(THEME_KEY); return v === "light" || v === "dark" ? v : null; } catch { return null; }
};
const listeners = new Set<() => void>();

function apply() {
  const forced = stored();
  if (forced) document.documentElement.setAttribute("data-lg-theme", forced);
  else document.documentElement.removeAttribute("data-lg-theme");
  listeners.forEach((f) => f());
}

function subscribe(cb: () => void) {
  const m = mq(), onStorage = (e: StorageEvent) => { if (e.key === THEME_KEY) apply(); };
  listeners.add(cb);
  m.addEventListener("change", cb);
  addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); m.removeEventListener("change", cb); removeEventListener("storage", onStorage); };
}

/** dark: the theme in effect; appearance: the pick, or "auto" for the system (pass it to <Duet appearance>). */
export function useTheme() {
  const forced = useSyncExternalStore(subscribe, stored, () => null);
  const system = useSyncExternalStore(subscribe, () => mq().matches, () => false);
  const dark = forced ? forced === "dark" : system;
  const toggle = () => {
    // Picking what the system already shows drops the pick, so the site follows the system again.
    const next = dark ? "light" : "dark";
    try { if ((next === "dark") === mq().matches) localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, next); } catch {}
    apply();
  };
  return { dark, appearance: forced ?? "auto", toggle } as const;
}

// The Integrate section's tint picker, kept like the theme so the stage's iframe follows it.
const TINT_KEY = "duet-tint";
/** iOS system colours that read well as an accent on glass, light and dark. */
export const TINTS = [
  ["Blue", "#0088ff"], ["Purple", "#cb30e0"], ["Pink", "#ff2d55"], ["Orange", "#ff8d28"], ["Green", "#34c759"], ["Graphite", "#8e8e93"],
] as const;
const tintListeners = new Set<() => void>();
const storedTint = () => { try { return localStorage.getItem(TINT_KEY); } catch { return null; } };
function subscribeTint(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === TINT_KEY) cb(); };
  tintListeners.add(cb);
  addEventListener("storage", onStorage);
  return () => { tintListeners.delete(cb); removeEventListener("storage", onStorage); };
}

/** The picked tint (undefined: Duet's default blue) and a setter. */
export function useTint() {
  const tint = useSyncExternalStore(subscribeTint, storedTint, () => null) ?? undefined;
  const setTint = (c: string) => {
    try { if (c === TINTS[0][1]) localStorage.removeItem(TINT_KEY); else localStorage.setItem(TINT_KEY, c); } catch {}
    tintListeners.forEach((f) => f());
  };
  return { tint, setTint };
}

