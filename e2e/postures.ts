import type { Signals } from '../packages/duet-ui/src/geometry';
const base = { insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0, standalone: false, pixelRatio: 3, framed: false };
function signals(iw: number, ih: number, ow: number, oh: number, extra: Partial<Signals> = {}): Signals {
  return { ...base, innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh, screenWidth: ow, screenHeight: oh, visualHeight: ih, ...extra };
}
// Inputs copied from measured geometry fixtures, not inferred from the desktop browser viewport.
export const postures = [
  { name: 'folded-portrait', mode: 'column', s: signals(382, 580, 466, 678) },
  { name: 'folded-landscape-left', mode: 'column', s: signals(594, 368, 678, 466, { angle: 90 }) },
  { name: 'folded-landscape-right', mode: 'column', s: signals(594, 368, 678, 466, { angle: 270 }) },
  { name: 'unfolded', mode: 'inline', s: signals(951, 543, 951, 669) },
  { name: 'unfolded-tall-left', mode: 'inline', s: signals(669, 825, 669, 951, { angle: 0 }) },
  { name: 'unfolded-tall-right', mode: 'inline', s: signals(669, 825, 669, 951, { angle: 180 }) },
  { name: 'split-view', mode: 'column', s: signals(385, 571, 469, 669, { screenWidth: 466, screenHeight: 678, angle: 270 }) },
  { name: 'url-bar-collapsed', mode: 'column', s: signals(382, 598, 466, 678) },
  { name: 'shared-link-banner', mode: 'column', s: signals(382, 540, 466, 678) },
  { name: 'keyboard', mode: 'column', s: signals(382, 580, 466, 678, { visualHeight: 272, editing: true }) },
  { name: 'home-screen-safe-area', mode: 'strip', s: signals(382, 657, 466, 678, { standalone: true, insetRight: 84 }) },
  { name: 'phone-fallback', mode: 'inline', s: signals(390, 740, 390, 844, { pixelRatio: 3, userAgent: 'iPhone AppleWebKit Version/26.0 Mobile Safari/604.1', touchPoints: 5, insetTop: 47, insetBottom: 34 }) },
  { name: 'desktop-fallback', mode: 'inline', s: signals(1280, 800, 1280, 800, { userAgent: 'Desktop', touchPoints: 0 }) },
] as const;
