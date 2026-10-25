import { useId, type CSSProperties } from "react";
import type { ArtStyle } from "./data";

// Generated cover art: soft two-hue gradient plus a simple composition. Saturation and lightness stay in a
// narrow, muted band so the covers sit together like one shelf.
export const tone = (h: number, s = 52, l = 64) => `hsl(${h} ${s}% ${l}%)`;

/** `cover`: fill a positioned parent of any shape (cropped), instead of a square. */
export function Art({ hues: [a, b], style, size, radius = 8, label, className, cover }: {
  hues: [number, number]; style: ArtStyle; size?: number | string; radius?: number; label?: string; className?: string; cover?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = `g${id}`, s = `s${id}`, f = `f${id}`;
  const box: CSSProperties = cover ? { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }
    : { overflow: "hidden", width: size, aspectRatio: "1", borderRadius: radius, display: "block", flex: "none", boxShadow: "0 0 0 0.5px var(--hair)" };
  const W = "rgb(255 255 255 / ";
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio={cover ? "xMidYMid slice" : undefined} style={box} className={className ? `art ${className}` : "art"} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={tone(a, 55, 70)} /><stop offset="1" stopColor={tone(b, 48, 52)} /></linearGradient>
        <radialGradient id={s} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor={tone(a, 70, 88)} /><stop offset="1" stopColor={tone(a, 60, 72)} /></radialGradient>
        <filter id={f} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
      </defs>
      <g>
        <rect width="100" height="100" fill={`url(#${g})`} />
        {style === "sun" && <>
          <circle cx="50" cy="58" r="24" fill={`url(#${s})`} opacity="0.9" />
          <rect y="62" width="100" height="38" fill={tone(b, 40, 42)} opacity="0.55" />
          {[68, 75, 83, 92].map((y, i) => <rect key={y} y={y} width="100" height={1 + i * 0.4} fill={`${W}${0.18 - i * 0.03})`} />)}
        </>}
        {style === "rings" && [42, 34, 26, 18, 10].map((r, i) => <circle key={r} cx="64" cy="38" r={r} fill="none" stroke={`${W}${0.16 + i * 0.1})`} strokeWidth="1.6" />)}
        {style === "waves" && [0, 1, 2, 3].map((i) => (
          <path key={i} d={`M0 ${48 + i * 12} C 25 ${38 + i * 12}, 45 ${62 + i * 12}, 100 ${46 + i * 12} L100 100 L0 100Z`} fill={tone(b, 45, 70 - i * 9)} opacity={0.35 + i * 0.12} />
        ))}
        {style === "blobs" && <g filter={`url(#${f})`}>
          <circle cx="30" cy="34" r="26" fill={tone(a, 65, 76)} />
          <circle cx="72" cy="70" r="30" fill={tone(b, 55, 50)} />
          <circle cx="74" cy="26" r="16" fill={tone((a + b) / 2, 50, 82)} />
        </g>}
        {style === "dots" && Array.from({ length: 36 }, (_, i) => {
          const x = 15 + (i % 6) * 14, y = 15 + Math.floor(i / 6) * 14, hot = i === 14;
          return <circle key={i} cx={x} cy={y} r={hot ? 5 : 2.2} fill={hot ? tone(a, 70, 90) : `${W}0.45)`} />;
        })}
        {style === "arches" && [40, 31, 22, 13].map((r, i) => (
          <path key={r} d={`M${50 - r} 100 V${70 - r * 0.6} A${r} ${r} 0 0 1 ${50 + r} ${70 - r * 0.6} V100`} fill={tone(a, 45, 80 - i * 7)} opacity={0.5 + i * 0.1} />
        ))}
        {style === "bands" && [0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={-30 + i * 22} y="-20" width="11" height="150" transform="rotate(30 50 50)" fill={i % 2 ? tone(b, 50, 72) : `${W}0.22)`} />
        ))}
        {style === "orbit" && <>
          <circle cx="50" cy="50" r="30" fill="none" stroke={`${W}0.35)`} strokeWidth="0.8" />
          <circle cx="50" cy="50" r="16" fill={`url(#${s})`} />
          <circle cx="76" cy="35" r="4.5" fill={tone(b, 60, 88)} />
          <circle cx="24" cy="70" r="2" fill={`${W}0.7)`} />
        </>}
      </g>
    </svg>
  );
}
