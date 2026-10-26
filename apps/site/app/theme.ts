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

/** dark: the theme in effect; forced: whether it overrides the system (pass it to <Duet dark>). */
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
  return { dark, forced: forced ? forced === "dark" : undefined, toggle };
}

