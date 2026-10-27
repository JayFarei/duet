#!/usr/bin/env python3
"""The system journeys workbench's data: every placement a Safari window can land in on the Duo, and every step the
harness has filmed and judged there.

A placement is a window type (a Safari tab, an in-app preview style, a Split View pane...) on a screen (folded or
unfolded, upright or turned), with 0, 1 or 2 Live Activities running and, for Safari's own windows, its tab bar at
the bottom or the top. Each step a journey or suite plays ends in one; the step's result (status, reasons, final
placement, Duet's slots, Safari's buttons, screenshot, video) is an observation of it. Placements nothing has played
yet stay in the matrix, marked untested, with why.

For each journey or suite, only the newest report that ran it counts, so replaying one (`run.sh --catalogue --only
la03`) refreshes its placements. Writes reports/workbench.json, which the site's /workbench page (dev only) draws.

  python3 -I tools/e2e/workbench.py [reports dir]
"""
import json
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catalogue  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

# Window types: id, label, the screens it exists on (None: all), whether Safari's tab bar setting applies, and why
# the harness has not played it yet (None: journeys or suites can reach it).
SCREENS = [("closed", 0), ("closed", 90), ("closed", 270), ("open", 0), ("open", 90), ("open", 270)]
TURNED = [("closed", 90), ("closed", 270)]
WIDE = [("open", 0)]
WINDOWS = [
    ("tab", "Safari tab", None, True, None),
    ("tab-bars", "Safari tab, bars at the top", TURNED, True, None),
    ("sheet", "In-app preview, sheet", None, False, None),
    ("default", "In-app preview, default", None, False, None),
    ("full", "In-app preview, full screen", None, False, None),
    ("over", "In-app preview, over full screen", None, False, None),
    ("split", "Split View pane", WIDE, True, "Split View: the harness drives it in scenarios (split, split-turn), not in journeys yet."),
    ("window", "Window beside the Home Screen", WIDE, True, "A Safari window beside the Home Screen: not driven by the harness yet."),
    ("webapp", "Home Screen web app", None, False, "A web app added to the Home Screen: not driven by the harness yet."),
]
LIVE = (0, 1, 2)
TABBARS = ("bottom", "top")
TABBAR_GAP = catalogue.SUITE_GAPS[0]
SIZE = {"closed": (466, 678), "open": (951, 669)}


def screen_id(posture, angle):
    return f"{posture}{angle}"


def screen_en(posture, angle):
    return ("Folded, " if posture == "closed" else "Unfolded, ") + catalogue.angle_en(posture, angle)


def screen_size(posture, angle):
    w, h = SIZE[posture]
    return (w, h) if angle == 0 else (h, w)


def place_id(window, screen, live, tabbar):
    return f"{window}.{screen}.la{live}" + (f".{tabbar}" if tabbar else "")


def expected(window, posture, angle):
    if window == "tab-bars":
        return dict(catalogue.LANDSCAPE_TOP_BARS)
    if window == "split":
        return dict(catalogue.SPLIT)
    if window in ("window", "webapp"):
        return None
    return catalogue.expect((window, posture, angle, False))


def expect_words(e):
    if not e:
        return "not specified yet (EXPECTED.md)"
    if e.get("hidden"):
        return "controls hidden, the page keeps its full width, the preview's own buttons untouched"
    where = {"column": "in a column", "inline": "inline", "strip": "in a strip in the side inset"}[e["mode"]]
    side = "both edges" if e["side"] == "both" else "the " + e["side"]
    gap = " in the gap of the preview's own column" if e.get("gap") else ""
    return f"controls {where} on {side}{gap}"


def universe():
    out = []
    for wid, label, screens, tabbar, why in WINDOWS:
        for posture, angle in screens or SCREENS:
            exp = expected(wid, posture, angle)
            for live in LIVE:
                for tb in TABBARS if tabbar else (None,):
                    out.append({"id": place_id(wid, screen_id(posture, angle), live, tb), "window": wid,
                                "screen": screen_id(posture, angle), "live": live, "tabbar": tb, "expect": exp,
                                "expect_en": expect_words(exp),
                                "untested": TABBAR_GAP if tb == "top" else why})
    return out


# ---- steps to placements -------------------------------------------------------------------------------------------
def plans():
    """{journey or suite id: ([(state, live, words)] per step from 1, start state, env)} from the catalogue, for
    reports written before results carried their state."""
    out = {}
    for i, (start, acts) in enumerate(catalogue.journeys()):
        out[catalogue.jid(i)] = ([(st, int(st[3]), w) for _, st, w, _ in catalogue.steps_en(start, acts)], start, {})
    for su in catalogue.SUITES:
        live = catalogue.suite_live(su)
        out[su["id"]] = ([(st, n, w) for (_, st, w, _, _), n in zip(catalogue.suite_steps(su), live)], su["start"], su.get("env") or {})
    return out


def size(s):
    w, h = (s or "0x0").split("x")
    return float(w), float(h)


def window_of(state, final):
    surface, posture, angle, _ = state
    if surface == "tab" and posture == "closed" and angle and final:
        iw, _ = size(final.get("inner"))
        ow, oh = size(final.get("outer"))
        if catalogue.top_bars({"innerWidth": iw, "outerWidth": ow, "outerHeight": oh}):
            return "tab-bars"
    return surface


def locate(r, plan):
    """(state, live) a step ended in: its own record, else the catalogue's plan if the words still match."""
    if r.get("state"):
        return tuple(r["state"]), r.get("live", int(r["state"][3]))
    if not plan:
        return None
    m = re.search(r"-(\d+)$", r["id"])
    k = int(m.group(1)) if m else -1
    steps, start, _ = plan
    if k == 0:
        return start, int(start[3])
    if 1 <= k <= len(steps):
        st, live, words = steps[k - 1]
        if r["desc"].split(" (from")[0][:24] == words.split(" (from")[0][:24] or r["desc"].startswith("Open"):
            return st, live
    return None


def reports(root):
    """Report dirs with results, oldest first."""
    found = []
    for name in os.listdir(root):
        p = os.path.join(root, name, "results.json")
        if os.path.isfile(p):
            found.append((os.path.getmtime(p), name))
    return [n for _, n in sorted(found)]


def media(root, report, rel):
    """A report-relative path as a reports-relative one, if the file is there."""
    if not rel:
        return None
    p = f"{report}/{rel}"
    return p if os.path.isfile(os.path.join(root, p)) else None


def thumb(root, shot):
    """A small JPEG beside a screenshot (macOS sips), so the workbench's cards load fast; made once."""
    if not shot:
        return None
    rel = shot[:-4] + ".thumb.jpg"
    src, out = os.path.join(root, shot), os.path.join(root, rel)
    if not os.path.isfile(out) or os.path.getmtime(out) < os.path.getmtime(src):
        r = subprocess.run(["sips", "-Z", "480", "-s", "format", "jpeg", "-s", "formatOptions", "70", src, "--out", out], capture_output=True)
        if r.returncode:
            return None
    return rel


def build(root):
    places = universe()
    by_id = {p["id"]: p for p in places}
    for p in places:
        p["obs"] = []
    plan = plans()
    newest, data = {}, {}
    for name in reports(root):
        d = json.load(open(os.path.join(root, name, "results.json")))
        data[name] = d
        for r in d.get("results", []):
            if r.get("journey"):
                newest[r["journey"]] = name
    journeys, stray = {}, 0
    for name, d in data.items():
        for j in d.get("journeys", []):
            if newest.get(j["id"]) == name:
                journeys[j["id"]] = {"id": j["id"], "title": j["title"], "status": j["status"], "report": name,
                                     "film": media(root, name, j.get("film")), "steps": j["steps"]}
        for r in d.get("results", []):
            jid = r.get("journey")
            if not jid or newest.get(jid) != name:
                continue
            got = locate(r, plan.get(jid))
            if not got:
                stray += 1
                continue
            state, live = got
            window = window_of(state, r.get("final"))
            env = plan[jid][2] if jid in plan else {}
            pid = place_id(window, screen_id(state[1], state[2]), min(live, 2), "bottom" if any(w[0] == window and w[3] for w in WINDOWS) else None)
            if pid not in by_id:
                stray += 1
                continue
            frames = r.get("frames")
            video = media(root, name, frames.replace("-frames.png", ".mp4")) if frames else None
            video = video or media(root, name, (r.get("shot") or "").replace(".png", ".mp4"))
            by_id[pid]["obs"].append({
                "id": r["id"], "journey": jid, "report": name, "desc": r["desc"], "status": r["status"],
                "reasons": r.get("reasons", []), "notes": r.get("notes", []), "expect_en": r.get("expect_en"),
                "check": r.get("check"), "env": env or None, "final": r.get("final"), "slots": r.get("slots", []),
                "native": r.get("native", []), "settle_ms": r.get("settle_ms"),
                "shot": media(root, name, r.get("shot")), "thumb": thumb(root, media(root, name, r.get("shot"))), "overlay": media(root, name, r.get("overlay")),
                "frames": media(root, name, frames), "video": video})
    rank = {"FAIL": 0, "BLOCKED": 1, "PASS": 2}
    for p in places:
        p["obs"].sort(key=lambda o: (rank.get(o["status"], 3), not o["video"], o["id"]))
        got = {o["status"] for o in p["obs"]}
        p["status"] = "FAIL" if "FAIL" in got else "PASS" if "PASS" in got else "BLOCKED" if got else "untested"
    count = lambda st: sum(p["status"] == st for p in places)
    return {
        "generated": time.strftime("%Y-%m-%d %H:%M"),
        "reports": [n for n in data if n in set(newest.values())],
        "windows": [{"id": w, "label": label, "note": why} for w, label, _, _, why in WINDOWS],
        "screens": [{"id": screen_id(po, an), "posture": po, "angle": an, "label": screen_en(po, an),
                     "w": screen_size(po, an)[0], "h": screen_size(po, an)[1]} for po, an in SCREENS],
        "places": places,
        "journeys": journeys,
        "summary": {"places": len(places), **{st: count(st) for st in ("PASS", "FAIL", "BLOCKED", "untested")}, "stray": stray},
    }


def write(root):
    out = build(root)
    with open(os.path.join(root, "workbench.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))
    return out


if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "reports")
    s = write(root)["summary"]
    stray = f", {s['stray']} steps not placed" if s["stray"] else ""
    print(f"{s['places']} placements: {s['PASS']} pass, {s['FAIL']} fail, {s['BLOCKED']} blocked, {s['untested']} untested{stray}"
          f" -> {os.path.join(root, 'workbench.json')}")
