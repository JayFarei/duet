// The few system glyphs the chrome draws itself, inlined so the package has no icon dependency.
// Paths from Lucide (ISC, https://lucide.dev): chevron-left, ellipsis, search, x, arrow-left-right,
// maximize-2, minimize-2.
import type { ReactNode } from "react";

const icon = (paths: ReactNode) => function Icon({ size = 22, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths}</svg>
  );
};

export const ChevronLeft = icon(<path d="m15 18-6-6 6-6" />);
export const Ellipsis = icon(<><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>);
export const Search = icon(<><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></>);
export const X = icon(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const ArrowLeftRight = icon(<><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></>);
export const Maximize = icon(<><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="m21 3-7 7" /><path d="m3 21 7-7" /></>);
export const Minimize = icon(<><path d="M4 14h6v6" /><path d="M20 10h-6V4" /><path d="m14 10 7-7" /><path d="m3 21 7-7" /></>);
