import type { Line } from "./data";

export function LineBadge({ line, size = 26 }: { line: Line; size?: number }) {
  return (
    <span className="badge" style={{ background: line.color, width: size, height: size, fontSize: size * 0.52, borderRadius: size * 0.3 }} aria-label={line.name}>
      {line.short}
    </span>
  );
}
