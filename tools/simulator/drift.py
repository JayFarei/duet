"""drift.py video.mp4 [--expect N] [--cx 417.8] [--top 200] [--tol 1] [--out track.png]

Column-mode invariant: every control in Safari's right column (ours and Safari's own back / bookmarks / + / tabs)
stays still on screen while the page scrolls. Finds the white glyphs in the column in frame 0, tracks each one
vertically through the recording and fails if any moves more than --tol points. Coordinates are points (video is 3x).
Safari's own glyphs act as the control: if they "move", the tracker is wrong, not our chrome. --expect also fails
the run when controls are missing (a layer that stops painting in the column would otherwise pass).
"""
import argparse, sys
import cv2, numpy as np

p = argparse.ArgumentParser()
p.add_argument("video"); p.add_argument("--cx", type=float, default=417.8, help="column centre, pt")
p.add_argument("--top", type=float, default=200, help="ignore the status area above this, pt")
p.add_argument("--tol", type=float, default=1.0, help="max allowed drift, pt")
p.add_argument("--search", type=float, default=30, help="vertical search range, pt")
p.add_argument("--expect", type=int, help="number of controls that must be on screen (ours + Safari's)")
p.add_argument("--out", help="write a per-glyph y(t) plot here")
a = p.parse_args()

cap = cv2.VideoCapture(a.video)
frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    frames.append(f)
if not frames: sys.exit(f"no frames in {a.video}")
S = frames[0].shape[1] / 466  # px per pt
cx, half, top, rng = round(a.cx * S), round(22 * S), round(a.top * S), round(a.search * S)

def glyphs(f):
    """Glyph mask of the column stripe: pixels far from their local background (white or coloured icons on any
    glass). Rows that light up across most of the stripe are page edges scrolling past, not glyphs."""
    st = f[:, cx - half:cx + half].astype(np.int16)
    bg = cv2.medianBlur(f[:, cx - half:cx + half], 31).astype(np.int16)
    m = np.abs(st - bg).sum(2) > 100
    m[m.mean(1) > 0.6] = False
    # glyph strokes are 1.5pt+; an opening drops 1px rims and highlights so each control is one glyph
    return cv2.morphologyEx((m * 255).astype(np.uint8), cv2.MORPH_OPEN, np.ones((4, 4), np.uint8))

m0 = glyphs(frames[0])
rows = m0.sum(1) > 0
rows[:top] = False
segs, y = [], 0
while y < len(rows):  # runs of glyph rows, merged across gaps under 6pt
    if rows[y]:
        s = y
        while y < len(rows) and (rows[y:y + round(6 * S)].any()): y += 1
        if y - s > 2 * S: segs.append((s, y))
    y += 1

pad = round(4 * S)
tracks = []
for s, e in segs:
    t = m0[s - pad:e + pad].astype(np.float32)
    ys = []
    for f in frames:
        lo, hi = max(0, s - pad - rng), min(f.shape[0], e + pad + rng)
        r = cv2.matchTemplate(glyphs(f)[lo:hi].astype(np.float32), t, cv2.TM_CCORR_NORMED)
        _, score, _, loc = cv2.minMaxLoc(r)
        ys.append((lo + loc[1] - (s - pad)) / S if score > 0.6 else np.nan)  # nan: glyph hidden (menu open, etc.)
    tracks.append(((s + e) / 2 / S, np.array(ys)))

bad = False
print(f"{len(frames)} frames, {len(tracks)} glyphs in the column (y in pt, drift = max |dy| from frame 0)")
for yc, ys in tracks:
    d = np.nanmax(np.abs(ys)) if np.isfinite(ys).any() else np.nan
    worst = int(np.nanargmax(np.abs(ys))) if np.isfinite(d) else -1
    seen = np.isfinite(ys).mean()
    flag = "skip (transient)" if seen < 0.5 else "FAIL" if d > a.tol else "ok"
    bad |= seen >= 0.5 and d > a.tol
    print(f"  glyph @ y={yc:6.1f}  drift {d:5.1f}pt  (frame {worst})  seen {seen:.0%}  {flag}")

steady = sum(np.isfinite(ys).mean() >= 0.5 for _, ys in tracks)
if a.expect is not None and steady != a.expect:
    print(f"FAIL: {steady} controls on screen, expected {a.expect}")
    bad = True

if a.out:
    W, H = len(frames) * 4 + 80, 40 * len(tracks) + 20
    img = np.full((H, W, 3), 255, np.uint8)
    for k, (yc, ys) in enumerate(tracks):
        base = 20 + 40 * k + 20
        cv2.line(img, (80, base), (W, base), (220, 220, 220), 1)
        cv2.putText(img, f"y={yc:.0f}", (4, base + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)
        for i, v in enumerate(ys):
            if np.isfinite(v): cv2.circle(img, (80 + i * 4, base - round(v * 2)), 1, (0, 0, 255) if abs(v) > a.tol else (0, 150, 0), -1)
    cv2.imwrite(a.out, img)
sys.exit(1 if bad else 0)
