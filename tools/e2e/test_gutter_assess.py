"""Run.gutter_assess (sa20+): no dead gutter in a landscape Home Screen web app. python tools/e2e/test_gutter_assess.py"""
import os, sys, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2e import Run

PAGE = "rgb(13, 15, 20)"


def g(W=951, outer=951, inset=84, mode="strip", side="right", col=(878.5, 927.5), right=None, left=12, paint=None):
    """A probe gutter measure (probe-proxy.mjs): by default the healthy wide strip, content to its gutter from the rail."""
    right = W - inset - 11 if right is None else right
    pt = lambda x, bg=PAGE, duet=False: [{"x": x, "y": y, "el": "div.card", "bg": bg, "duet": duet} for y in (130, 260)]
    return {"W": W, "H": 648, "outer": {"w": outer, "h": 669}, "env": {"t": 0, "r": inset, "b": 21, "l": 0},
            "duet": {"mode": mode, "side": side, "insetL": 0, "insetR": inset},
            "col": col and {"x": col[0], "r": col[1], "y": 60, "b": 600},
            "content": {"left": left, "right": right, "who": {"right": "div.grid", "left": "div.grid"}},
            "paint": paint or {"page": PAGE, "railR": pt(W - inset / 2) + pt(W - inset / 2, "rgb(1, 1, 1)", True), "railL": [], "gapR": [], "gapL": []}}


class GutterAssess(unittest.TestCase):
    def test_healthy_strip_passes(self):
        self.assertEqual(Run.gutter_assess(g(), {}), [])

    def test_content_at_the_rail_passes(self):
        self.assertEqual(Run.gutter_assess(g(right=951 - 84), {}), [])

    def test_gabriele_dashboard_fails(self):
        """The dashboard, 2026-11: the page 867 in a 951 window, Duet inline (84 reserved), cards to ~785."""
        got = Run.gutter_assess(g(W=867, inset=84, mode="inline", col=(794.5, 843.5), right=785), {})
        self.assertTrue(any("84pt band outside the page" in r for r in got), got)
        self.assertFalse(any("stops" in r for r in got), got)  # 867 - 84 - 785 = -2: the content meets this rail

    def test_band_alone_fails(self):
        got = Run.gutter_assess(g(outer=953), {})
        self.assertEqual(len(got), 1)
        self.assertIn("2pt band", got[0])

    def test_content_short_of_rail_fails(self):
        got = Run.gutter_assess(g(right=951 - 84 - 30), {})
        self.assertEqual(len(got), 1)
        self.assertIn("30pt short of the rail", got[0])

    def test_gutter_bound_is_inclusive(self):
        self.assertEqual(Run.gutter_assess(g(right=951 - 84 - 11.5), {}), [])
        self.assertTrue(Run.gutter_assess(g(right=951 - 84 - 12), {}))

    def test_column_outside_rail_fails(self):
        got = Run.gutter_assess(g(col=(840, 889)), {})
        self.assertTrue(any("outside its rail" in r for r in got), got)

    def test_no_rail_fails(self):
        got = Run.gutter_assess(g(inset=0, col=(878.5, 927.5), right=940), {})
        self.assertTrue(any("no rail" in r for r in got), got)

    def test_left_side(self):
        ok = g(side="left", inset=0, col=(23.5, 72.5), left=84 + 11, right=940)
        ok["duet"]["insetL"], ok["duet"]["insetR"] = 84, 0
        self.assertEqual(Run.gutter_assess(ok, {}), [])
        bad = g(side="left", inset=0, col=(23.5, 72.5), left=84 + 40, right=940)
        bad["duet"]["insetL"], bad["duet"]["insetR"] = 84, 0
        self.assertTrue(any("40pt short" in r for r in Run.gutter_assess(bad, {})))

    def test_foreign_paint_in_rail_fails(self):
        m = g()
        m["paint"]["railR"].append({"x": 909, "y": 390, "el": "div.strip", "bg": "rgb(0, 0, 0)", "duet": False})
        got = Run.gutter_assess(m, {})
        self.assertEqual(len(got), 1)
        self.assertIn("rgb(0, 0, 0)", got[0])

    def test_no_measure_is_a_reason(self):
        self.assertTrue(Run.gutter_assess(None, {}))
        self.assertTrue(Run.gutter_assess({"error": "boom"}, {}))


if __name__ == "__main__":
    unittest.main()
