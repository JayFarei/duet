"""Run.sa_assess: the standalone column stays in its rail. python tools/e2e/test_sa_assess.py"""
import os, sys, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2e import Run

W, H, REST = 951, 669, (878.5, 265.0, 49.0, 359.0)


def sample(rx, rect=REST, left=(), standalone=True, vv=None):
    x, y, w, h = rect
    return {"rx": rx, "sig": {"innerWidth": W, "innerHeight": H}, "standalone": {"navigator": standalone, "displayMode": standalone},
            "column": {"groups": [{"rect": {"x": x, "y": y, "w": w, "h": h}}], "dragLeft": list(left)}, **({"vv": vv} if vv else {})}


def judge(side, long_, vv=None):
    """Each drag's mid samples, then a settled sample at rest unless the list already ends."""
    rs = [sample(0)] + [sample(100 + i, r, vv=vv) for i, r in enumerate(side)] + [sample(200 + i, r) for i, r in enumerate(long_)]
    res = {"before": [REST], "drags": [{"kind": "side", "t": 100}, {"kind": "long", "t": 200}], "reasons": [], "notes": []}
    Run.sa_assess(res, rs)
    return res


def scaled(k, dx=0.0, dy=0.0, kh=None):
    """REST scaled by k (kh tall) about its centre, then moved dx, dy."""
    kh = k if kh is None else kh
    w, h = REST[2] * k, REST[3] * kh
    return (REST[0] + REST[2] / 2 - w / 2 + dx, REST[1] + REST[3] / 2 - h / 2 + dy, w, h)


def rail(res, kind):
    return any(r.startswith(f"{kind} drag: the column left its rail") for r in res["reasons"])


class SaAssess(unittest.TestCase):
    def test_at_the_bound_passes(self):
        # 1.13x wide and tall about its rest centre, the centre 1pt off: the most press feedback may do.
        res = judge([scaled(1.13), scaled(1.13, dx=1), REST], [scaled(1.13, dy=-1), scaled(1.06), REST])
        self.assertEqual(res["reasons"], [])
        self.assertEqual(res["press"]["side"]["w"], 1.133)  # half-point rounding of 55.37
        self.assertTrue(any("largest press 1.13x wide" in n for n in res["notes"]))

    def test_past_the_scale_bound_fails(self):
        res = judge([scaled(1.16), REST], [REST])
        self.assertTrue(rail(res, "side"))
        self.assertTrue(any("scaled 1.16x wide" in r for r in res["reasons"]))
        res = judge([REST], [scaled(1.0, kh=1.16), REST])
        self.assertTrue(rail(res, "long"))

    def test_past_the_drift_bound_fails(self):
        res = judge([scaled(1.0, dx=2), REST], [REST])
        self.assertTrue(any("centre moved +2.0" in r for r in res["reasons"]))
        res = judge([REST], [scaled(1.1, dy=2.5), REST])
        self.assertTrue(rail(res, "long"))

    def test_designed_press_open_fails(self):
        # press.ts opens the held capsule to 78.8pt (P3c measured 83 with the overshoot), centred on its rest x, taller
        # and drifting with the finger: past the bound, so the column has left its rail.
        opened = (REST[0] + REST[2] / 2 - 41.5, REST[1] - 28 + 11, 83.0, 416.0)
        res = judge([REST, REST], [opened, opened, REST])
        self.assertTrue(rail(res, "long"))
        self.assertTrue(any("centre moved +0.0,+11.5pt" in r for r in res["reasons"]))  # the first reason it meets
        self.assertEqual(res["press"]["long"], {"w": 1.694, "h": 1.159, "dx": 0.0, "dy": 11.5})
        # In place, it still fails on its scale alone.
        res = judge([REST], [scaled(83 / 49, kh=1.0), REST])
        self.assertTrue(any("scaled 1.69x wide" in r for r in res["reasons"]))

    def test_side_switch_mid_drag_fails(self):
        res = judge([(W - REST[0] - REST[2], REST[1], REST[2], REST[3]), REST], [REST])
        self.assertTrue(rail(res, "side"))

    def test_following_the_finger_down_fails(self):
        res = judge([REST], [(REST[0], REST[1] + 200, REST[2], REST[3]), REST])
        self.assertTrue(rail(res, "long"))

    def test_zoomed_or_panned_page_moves_it_on_screen(self):
        # Same page rects, but the visual viewport is panned 30pt (or zoomed 1.2x): on screen the column moved.
        res = judge([REST, REST], [REST], vv={"x": 30, "y": 0, "scale": 1})
        self.assertTrue(rail(res, "side"))
        res = judge([REST, REST], [REST], vv={"x": 0, "y": 0, "scale": 1.2})
        self.assertTrue(rail(res, "side"))

    def test_not_back_after_release_fails(self):
        res = judge([REST, (REST[0], REST[1] + 2, REST[2], REST[3])], [REST])
        self.assertTrue(any("rects after the release" in r for r in res["reasons"]))

    def test_left_drag_state_and_not_standalone_fail(self):
        rs = [sample(0), sample(100, left=["duet-group"]), sample(200, standalone=False)]
        res = {"before": [REST], "drags": [{"kind": "side", "t": 100}, {"kind": "long", "t": 200}], "reasons": [], "notes": []}
        Run.sa_assess(res, rs)
        self.assertTrue(any("--duet-drag" in r for r in res["reasons"]))
        self.assertTrue(any("not standalone" in r for r in res["reasons"]))


if __name__ == "__main__":
    unittest.main()
