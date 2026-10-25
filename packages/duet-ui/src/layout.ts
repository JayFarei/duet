import type { CSSProperties } from "react";

// The page inside <Duet> spans the whole window and the controls float over it, so backgrounds run on under them
// (blueprint rules 14/15) and the layout is asymmetric: centred content centres on the device, with more room on
// the side away from the controls. Text and buttons keep clear by the insets Duet sets on <html>,
// --duet-inset-left and --duet-inset-right (the controls' width on each edge, or the safe area). Inside a pane
// of <DuetPanes> the same variables hold that pane's own insets, so the helpers work unchanged there.

const px = (v: number | string) => typeof v === "number" ? `${v}px` : v;
const L = "var(--duet-inset-left, 0px)", R = "var(--duet-inset-right, 0px)";

/** Style for a full-width band (a hero, a coloured banner, a sticky title bar, a list row): the band itself runs
 *  edge to edge, under the controls; its content is padded back by `padding` plus the inset on each side, so it
 *  lines up beside them. With `padding: false` nothing is padded, for content that should itself run under the
 *  controls (an image, a map). */
export function bleed(padding: number | string | false = 0): CSSProperties {
  if (padding === false) return {};
  const x = px(padding);
  return { paddingRight: `calc(${x} + ${R})`, paddingLeft: `calc(${x} + ${L})` };
}

/** Style for a centred reading column at most `maxWidth` wide. It centres on the whole width, like a native
 *  app's content on the device, and moves away from the controls only as far as it must to keep `padding` clear
 *  of them; narrower than that, it fills the space beside them. Spread it last: it sets the horizontal margins. */
export function column(maxWidth: number | string = 680, padding: number | string = 20): CSSProperties {
  const p = px(padding), w = `min(${px(maxWidth)}, 100% - ${L} - ${R} - 2 * ${p})`;
  return { boxSizing: "border-box", width: w, marginRight: 0, marginLeft: `clamp(${L} + ${p}, (100% - ${w}) / 2, 100% - ${R} - ${p} - ${w})` };
}
