"""Run.sa_assess: the standalone column stays in its rail. python tools/e2e/test_sa_assess.py"""
import os, sys, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2e import Run

W, H, REST = 951, 669, (878.5, 265.0, 49.0, 359.0)


def sample(rx, rect=REST, left=(), standalone=True):
    x, y, w, h = rect
    return {"rx": rx, "sig": {"innerWidth": W, "innerHeight": H}, "standalone": {"navigator": standalone, "displayMode": standalone},
            "column": {"groups": [{"rect": {"x": x, "y": y, "w": w, "h": h}}], "dragLeft": list(left)}}


def judge(side, long_):
    """Each drag's mid samples, then a settled sample at rest unless the list already ends."""
    rs = [sample(0)] + [sample(100 + i, r) for i, r in enumerate(side)] + [sample(200 + i, r) for i, r in enumerate(long_)]
    res = {"before": [REST], "drags": [{"kind": "side", "t": 100}, {"kind": "long", "t": 200}], "reasons": [], "notes": []}
    Run.sa_assess(res, rs)
    return res


class SaAssess(unittest.TestCase):
    def test_press_open_in_place_passes(self):
        # press.ts opens the held capsule to ~83pt, centred on its rest x, taller, drifting a little with the finger.
        opened = (REST[0] + REST[2] / 2 - 41.5, REST[1] - 28 + 11, 83.0, 416.0)
        res = judge([REST, REST], [opened, opened, REST])
        self.assertEqual(res["reasons"], [])
        self.assertTrue(any("press feedback 1.69x" in n for n in res["notes"]))

    def test_side_switch_mid_drag_fails(self):
        res = judge([(W - REST[0] - REST[2], REST[1], REST[2], REST[3]), REST], [REST])
        self.assertTrue(any("side drag: the column left its rail" in r for r in res["reasons"]))

    def test_following_the_finger_down_fails(self):
        res = judge([REST], [(REST[0], REST[1] + 200, REST[2], REST[3]), REST])
        self.assertTrue(any("long drag: the column left its rail" in r for r in res["reasons"]))

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
