import type { CSSProperties } from "react";

// Duet keeps page content clear of the controls by padding its scroller with --duet-inset-left/right. A band that
// should run edge to edge (a hero image, a coloured banner, a sticky title bar) uses `bleed()`: its background
// extends under the controls, but its own content is padded back so text and buttons line up beside them, never
// under them. In Safari's column it runs on under the column too (--duet-under), so the column's buttons float on
// the band's colour, like Safari's own.
const edge = {
  marginRight: "calc(-1 * var(--duet-inset-right, 0px) - var(--duet-under, 0px))",
  marginLeft: "calc(-1 * var(--duet-inset-left, 0px))",
  borderRight: "var(--duet-under, 0px) solid transparent",
  backgroundOrigin: "border-box",
} as const;

/** Style for a full-width band inside `<Duet>`. `padding` is the band's own horizontal padding (px or any CSS
 *  length); the inset beside the controls is added to it. With `padding: false` nothing is padded back, for
 *  content that should itself run under the controls (an image, a map). */
export function bleed(padding: number | string | false = 0): CSSProperties {
  if (padding === false) return { ...edge };
  const x = typeof padding === "number" ? `${padding}px` : padding;
  return { ...edge, paddingRight: `calc(${x} + var(--duet-inset-right, 0px))`, paddingLeft: `calc(${x} + var(--duet-inset-left, 0px))` };
}
