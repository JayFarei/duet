import { useEffect, type RefObject } from "react";

/** Focus non-modal navigation/popovers without trapping the rest of the page. */
export function useMenuFocus(ref: RefObject<HTMLElement | null>, open: boolean, dismiss: () => void) {
  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    const items = () => [...root.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    items()[0]?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); previous?.focus({ preventScroll: true }); dismiss(); }
      else if (e.key === "Tab") dismiss();
      else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        const all = items();
        if (!all.length) return;
        e.preventDefault();
        const at = all.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : (at + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length;
        all[next]?.focus();
      }
    };
    root.addEventListener("keydown", key);
    return () => {
      root.removeEventListener("keydown", key);
      if (root.contains(document.activeElement)) previous?.focus({ preventScroll: true });
    };
  }, [ref, open]); // dismiss only changes local open state; do not refocus on each render
}
