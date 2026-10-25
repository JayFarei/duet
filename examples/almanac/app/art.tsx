import type { CSSProperties, ReactNode } from "react";
import type { Art as Kind } from "./articles";

// Quiet tonal illustrations, one per story. Four tones of the story's hue (--t0 lightest to --t3 deepest, set in
// CSS for light and dark), plus a touch of the accent. The 800x300 canvas is sliced to fit, so the subject stays
// inside the central ~500x200.
const f = (n: 0 | 1 | 2 | 3): CSSProperties => ({ fill: `var(--t${n})` });
const s = (n: 0 | 1 | 2 | 3, w = 2): CSSProperties => ({ fill: "none", stroke: `var(--t${n})`, strokeWidth: w, strokeLinecap: "round" });
const accent: CSSProperties = { fill: "var(--accent)" };

const keepers = (
  <>
    <circle cx="540" cy="120" r="80" style={f(1)} opacity="0.7" />
    <polygon points="405,112 800,40 800,190" style={accent} opacity="0.12" />
    <rect y="214" width="800" height="86" style={f(1)} />
    {[232, 252, 274].map((y, i) => <path key={y} d={`M${60 + i * 40} ${y} h${120 - i * 20} M${520 - i * 30} ${y} h${140 + i * 20}`} style={s(2)} />)}
    <path d="M250 300 C 290 240, 330 228, 370 226 L 460 224 C 500 226, 520 250, 560 300 Z" style={f(3)} />
    <path d="M386 228 L 393 122 L 417 122 L 424 228 Z" style={f(0)} />
    <path d="M389.5 178 L 420.5 178 L 421.6 196 L 388.4 196 Z M392 140 L 418 140 L 418.9 156 L 391.1 156 Z" style={f(2)} />
    <rect x="389" y="98" width="32" height="24" rx="2" style={f(3)} />
    <path d="M385 98 L 405 82 L 425 98 Z" style={f(3)} />
    <circle cx="405" cy="110" r="6" style={accent} />
  </>
);

// Moss: overlapping cushions with fine stalks and capsules.
const cushions = Array.from({ length: 22 }, (_, i) => ({ x: 120 + i * 27 + (i % 3) * 7, r: 26 + ((i * 7) % 5) * 6, row: i % 3 }));
const moss = (
  <>
    <circle cx="260" cy="90" r="46" style={f(1)} opacity="0.6" />
    {Array.from({ length: 9 }, (_, i) => {
      const x = 250 + i * 38, h = 60 + ((i * 13) % 4) * 14, lean = (i % 2 ? 1 : -1) * 8;
      return <g key={i}><path d={`M${x} 230 q ${lean} ${-h / 2} ${lean * 1.6} ${-h}`} style={s(3, 1.6)} /><ellipse cx={x + lean * 1.6} cy={230 - h - 5} rx="3.2" ry="6" style={f(3)} /></g>;
    })}
    {cushions.map((c, i) => <circle key={i} cx={c.x} cy={250 + c.row * 16} r={c.r} style={f(c.row === 0 ? 2 : c.row === 1 ? 3 : 1)} />)}
    <rect y="276" width="800" height="24" style={f(3)} />
    <circle cx="452" cy="196" r="4" style={accent} />
  </>
);

// Islands: a chart with a real island, a dashed phantom and a compass.
const ring = (cx: number, cy: number, rx: number, ry: number, rot: number) => `translate(${cx} ${cy}) rotate(${rot}) scale(${rx} ${ry})`;
const islands = (
  <>
    {[100, 200, 300, 400, 500, 600, 700].map((x) => <path key={x} d={`M${x} 0 V300`} style={s(1, 1)} />)}
    {[60, 140, 220].map((y) => <path key={y} d={`M0 ${y} H800`} style={s(1, 1)} />)}
    {[1, 0.72, 0.45].map((k, i) => (
      <ellipse key={k} cx="0" cy="0" rx="1" ry="1" transform={ring(260, 160, 110 * k, 62 * k, -12)} style={i === 0 ? f(1) : i === 1 ? f(2) : f(3)} />
    ))}
    {[1, 0.66, 0.34].map((k) => (
      <ellipse key={k} cx="0" cy="0" rx="1" ry="1" transform={ring(470, 120, 70 * k, 40 * k, 18)} vectorEffect="non-scaling-stroke"
        style={{ ...s(3, 1.6), strokeDasharray: "5 6" }} />
    ))}
    <path d="M462 112 l16 16 M478 112 l-16 16" style={{ ...s(3, 2), stroke: "var(--accent)" }} />
    <g transform="translate(390 236) scale(0.8)">
      <circle r="26" style={s(3, 1.4)} />
      <path d="M0 -34 L 6 0 L 0 34 L -6 0 Z" style={f(3)} />
      <path d="M-34 0 L 0 5 L 34 0 L 0 -5 Z" style={f(2)} />
    </g>
  </>
);

// Starter: a jar of bubbling starter beside a scored loaf.
const starter = (
  <>
    <circle cx="560" cy="90" r="60" style={f(1)} opacity="0.6" />
    <rect y="236" width="800" height="64" style={f(1)} />
    <rect x="300" y="96" width="92" height="140" rx="16" style={f(0)} />
    <rect x="300" y="96" width="92" height="140" rx="16" style={s(2, 2)} />
    <path d="M304 150 Q 346 136 388 150 V 220 a12 12 0 0 1 -12 12 h-60 a12 12 0 0 1 -12 -12 Z" style={f(2)} />
    {[[322, 176, 5], [350, 196, 7], [372, 168, 4], [334, 212, 4], [366, 214, 5], [344, 164, 3]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} style={f(0)} opacity="0.8" />)}
    <rect x="294" y="84" width="104" height="16" rx="6" style={f(3)} />
    <ellipse cx="500" cy="212" rx="96" ry="40" style={f(3)} />
    <path d="M436 206 q 22 -18 46 -6 M470 196 q 22 -16 46 -4 M504 190 q 22 -14 44 0" style={s(1, 3)} />
    <ellipse cx="500" cy="248" rx="104" ry="5" style={f(2)} opacity="0.6" />
    <circle cx="350" cy="140" r="3.5" style={accent} />
  </>
);

// Index: an open book, a large initial on the left page, an index column on the right.
const lines = (x: number, y0: number, n: number, w: (i: number) => number) =>
  Array.from({ length: n }, (_, i) => <path key={i} d={`M${x} ${y0 + i * 14} h${w(i)}`} style={s(2, 3)} />);
const index = (
  <>
    <ellipse cx="400" cy="262" rx="250" ry="10" style={f(1)} />
    <path d="M400 72 C 340 58, 250 58, 180 72 V 256 C 250 242, 340 242, 400 256 Z" style={f(0)} />
    <path d="M400 72 C 460 58, 550 58, 620 72 V 256 C 550 242, 460 242, 400 256 Z" style={f(0)} />
    <path d="M400 72 V256" style={s(2, 1.5)} />
    <text x="214" y="168" style={{ ...f(3), font: "700 84px ui-serif, 'New York', Georgia, serif" }}>A</text>
    {lines(290, 116, 4, (i) => 80 - (i % 2) * 18)}
    {lines(214, 196, 3, (i) => 156 - i * 22)}
    {lines(430, 96, 10, (i) => 70 + ((i * 17) % 4) * 14)}
    {Array.from({ length: 10 }, (_, i) => <path key={i} d={`M574 ${96 + i * 14} h18`} style={s(3, 3)} />)}
    <path d="M430 152 h112" style={{ ...s(3, 3), stroke: "var(--accent)" }} />
  </>
);

const ART: Record<Kind, ReactNode> = { keepers, moss, islands, starter, index };

export function Art({ kind, hue, className, style }: { kind: Kind; hue: number; className?: string; style?: CSSProperties }) {
  return (
    <svg className={`art ${className ?? ""}`} viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" aria-hidden
      style={{ "--h": hue, ...style } as CSSProperties}>
      <rect width="800" height="300" style={f(0)} />
      {ART[kind]}
    </svg>
  );
}
