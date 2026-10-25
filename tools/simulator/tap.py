"""tap.py before.png after.png [--at x,y | --box x0,y0,x1,y1] [--same] [--min 0.15]

Did a tap do something? Compares the control glyphs (not the page behind them, which may reflow) of two
screenshots (3x) around the tapped point (--at, a 60pt square; default: Safari's whole column) and fails unless at least --min of the glyph
pixels changed, or, with --same, unless almost none did.
Column taps are routed by our code (Safari never hit-tests the column), so a tap that silently does nothing is
the regression to catch: take a shot, tap with duration 0.12 (zero-length injected taps deliver no events), shot.
"""
import argparse, sys
import cv2, numpy as np

p = argparse.ArgumentParser()
p.add_argument("before"); p.add_argument("after")
p.add_argument("--at", help="x,y in points: check the control under the tap only")
p.add_argument("--box", default="382,200,466,640", help="x0,y0,x1,y1 in points")
p.add_argument("--min", type=float, default=0.15, help="changed fraction of glyph pixels that counts as a reaction")
p.add_argument("--same", action="store_true", help="expect no reaction (e.g. back to the initial state)")
a = p.parse_args()

A, B = cv2.imread(a.before), cv2.imread(a.after)
if A is None or B is None or A.shape != B.shape: sys.exit("unreadable or mismatched screenshots")
S = A.shape[1] / 466
if a.at: x, y = map(float, a.at.split(",")); a.box = f"{x - 30},{y - 30},{x + 30},{y + 30}"
x0, y0, x1, y1 = (round(float(v) * S) for v in a.box.split(","))

def glyphs(f):  # same mask as drift.py: pixels far from their local background, minus page edges
    f = f[y0:y1, x0:x1]
    m = np.abs(f.astype(np.int16) - cv2.medianBlur(f, 31).astype(np.int16)).sum(2) > 100
    m[m.mean(1) > 0.6] = False
    return cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((4, 4), np.uint8)) > 0

ga, gb = glyphs(A), glyphs(B)
frac = (ga ^ gb).sum() / max(1, (ga | gb).sum())
ok = frac < a.min / 3 if a.same else frac >= a.min
print(f"{frac:.1%} of the glyphs changed, expected {'almost none' if a.same else f'at least {a.min:.0%}'}: {'ok' if ok else 'FAIL'}")
sys.exit(0 if ok else 1)
