#!/usr/bin/env python3
"""Duo e2e matrix: drives the "Duo Lab" simulator through Safari tab, in-app preview and unfolded states, rotations
and folds (tools/e2e/fold/fold.bin), collects the page's Duet state from the beacon every ~40ms, native button
frames from the UI-test runner (closed screen) or the simulator helper (sim.py, unfolded and split view), a screenshot per step and a video contact sheet per transition, and asserts
tools/e2e/EXPECTED.md on every sample, not only the last. Writes reports/<ts>/{index.html,steps/*.json,shots/*}.

With --catalogue it plays the journeys of catalogue.py instead (CATALOGUE.md, every state and transition in plain
English), each filmed; --shard i/N plays every Nth of them so tools/e2e/matrix.sh can spread them over several
simulators, each with its own beacon (--beacon), and --merge joins the shard reports into one.

Needs (run.sh starts them): site on :3140 (served from this worktree), beacon on :3141, the UI-test runner; split view
and the unfolded native checks need the Claude desktop app's simulator helper (sim.py), reported BLOCKED without it.
Usage: e2e.py --udid <sim> [--only <scenario>[,<scenario>]] [--page /path] [--md round.md] [--video]
       e2e.py --udid <sim> --catalogue [--only j01,j07] [--shard 2/4] [--beacon http://localhost:3152] [--out dir]
       e2e.py --merge <dir with shard-*/results.json>
Exit: 0 all PASS, 1 any FAIL, 2 any BLOCKED (a state the run could not reach, or a broken setup).
"""
import argparse, datetime, html, json, os, signal, subprocess, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # run with python -I, which leaves the script dir out
from sim import Sim, SimError  # noqa: E402
import catalogue  # noqa: E402
from catalogue import TAB, LANDSCAPE_TOP_BARS, PREVIEW, preview_expect, UNFOLDED, UNFOLDED_PREVIEW, SPLIT  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = "http://localhost:3140"
BEACON = "http://localhost:3141"
HOST = "dev.duolab.e2e.host"
SAFARI = "com.apple.mobilesafari"
SPRINGBOARD = "com.apple.springboard"
PREVIEW_SVC = "com.apple.SafariViewService"
FOLD = os.path.join(HERE, "fold", "fold.bin")
MIN_S = 2.5     # each step samples at least this long after its action
QUIET_S = 1.5   # and until the signals have not changed for this long
MAX_S = 7.0     # but never longer than this
SETTLE_S = 0.5  # controls must show in the final placement within this of the final signals
GRACE_S = 0.15  # the old placement may linger this long after the signals first change (one render of the chrome)
SLIDE_S = 0.15  # once shown in the final placement, slots must stop moving within this (no slow slide)
SPRING_S = 0.6  # a page change in place (a tap opens a page, a call to action turns "Booked") springs its slots (#101)
GAP_S = 0.15    # sampling gaps longer than this are reported (the page was throttled)
ICON_SD = 6.0   # a visible slot icon whose screenshot crop has a luminance stddev under this is not painted
STATE_TIMEOUT = 30

# Rotator orientation per closed-screen angle (fold.bin -deviceOrientation). The page reports landscapeRight as 90.
ORIENT = {0: "portrait", 90: "landscapeRight", 270: "landscapeLeft", 180: "portraitUpsideDown"}
CLOSED = {"position": "closed"}
# Expected per state (EXPECTED.md): catalogue.py, shared with the journeys.
SB_SAFARI = "Safari"              # SpringBoard accessibility identifiers (dock icon, our host's icon, menu item)
SB_HOST = "DuoE2EHost"
SB_SPLIT = "com.apple.springboardhome.application-shortcut-item.open-in-split"
INNER_W = 951                     # wide inner display, points
DIVIDER = (476, 335)              # split view divider handle on the wide inner display
# Rotation path: every turn between the three UI angles, both directions (0->90, 90->270, 270->0, 0->270, 270->90, 90->0).
PATH = [90, 270, 0, 270, 90, 0]


def http(method, path, body=None, timeout=70):
    req = urllib.request.Request(BEACON + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"null")
    except OSError:
        return None


def cmd(op, **kw):
    return http("POST", "/cmd?timeout=60000", {"op": op, **kw})


def sh(*a, check=True):
    return subprocess.run(a, capture_output=True, text=True, check=check)


def samples(step, since=0):
    return http("GET", f"/samples?step={step}&since={since}") or []


def mine(r, tok):
    """A sample of this run: its token in the URL, or in the page's storage once a pushState or a link dropped it."""
    return f"s={tok}" in r["path"] or r.get("s") == tok


def address(path):
    """A sample's path without the harness's own parameters (e2e, s): "/book?c=sauna"."""
    p, _, q = path.partition("?")
    q = [kv for kv in q.split("&") if kv and kv.split("=")[0] not in ("e2e", "s")]
    return p + ("?" + "&".join(q) if q else "")


def duet_buttons(r, back=False):
    """[(label, rect)] of Duet's shown buttons in a sample, an open menu's items included. back: only Duet's back (its
    slot, or a plain menu item), not a tab of the same name ("Classes" is /book's back and its first tab)."""
    return [(b["label"], b["rect"]) for n in shown_navs(r) for g in n["slots"] + (n.get("menus") or []) for b in g.get("buttons") or []
            if not back or g.get("slot") == "back" or b.get("role") == "menuitem"]


def menu_items(r):
    """Labels of an open Duet menu's items."""
    return [b["label"] for n in shown_navs(r) for m in n.get("menus") or [] for b in m.get("buttons") or []]


def opener(r):
    """The rect of the button whose menu holds what Duet folded: "…", else the lone selected tab where the band holds
    one button (its menu lists the tabs, then the rest: closed landscape, the preview under Live Activities)."""
    more = next((rc for l, rc in duet_buttons(r) if l == "More"), None)
    if more:
        return more
    tabs = [sl for n in shown_navs(r) for sl in n["slots"] if sl["slot"] == "tabs" and len(sl.get("buttons") or []) == 1]
    return tabs[0]["buttons"][0]["rect"] if tabs else None


def key(r):
    g = r["sig"]
    return (g["angle"], g["innerWidth"], g["innerHeight"], g["outerWidth"], g["outerHeight"])


def nav(r):
    return (r.get("navs") or [{}])[0]


def shown_navs(r):
    return [n for n in r.get("navs") or [] if n.get("slots") and not n.get("hidden")]


def shown_place(r):
    """(mode, side) when Duet's controls are visible, None when hidden (data-hidden, or no visible slot). Two column
    copies on opposite edges (split view) are ("column", "both")."""
    ns = shown_navs(r)
    if not ns:
        return None
    if len(ns) > 1 and all(n.get("mode") == "column" for n in ns) and len({n.get("side") for n in ns}) > 1:
        return ("column", "both")
    return (ns[0].get("mode"), ns[0].get("side"))


def all_slots(r):
    """[{slot, rect}] over every visible nav; a slot name is prefixed with its side when two navs are drawn."""
    ns = shown_navs(r)
    return [{"slot": (f'{n.get("side")}:' if len(ns) > 1 else "") + x["slot"], "rect": x["rect"], "icons": x.get("icons", [])} for n in ns for x in n["slots"]]


def is_split(g):
    """A split view pane, 469x669 (the closed portrait window is 466x678)."""
    return (g["outerWidth"], g["outerHeight"]) == (469, 669)


class Run:
    def __init__(s, a):
        s.a, s.udid = a, a.udid
        s.out = os.path.abspath(a.out) if a.out else os.path.join(HERE, "reports", datetime.datetime.now().strftime("%Y%m%d-%H%M%S"))
        for d in ("steps", "shots"):
            os.makedirs(os.path.join(s.out, d), exist_ok=True)
        s.results, s.angle, s.position, s.page, s.last = [], 0, "closed", None, None
        s.la_on = False  # a Live Activity is running (the host's music activity, la())
        s.page_path = a.page
        s.films = []  # (scenario, stitched clips) for the report
        s.journeys = []  # catalogue journeys played (--catalogue): id, title, steps in words, status, film
        s.split = None  # Safari's split view pane, "left" or "right", or None when Safari is full screen
        s.sim = Sim(s.udid) if Sim.available() else None

    def log(s, *m):
        print(*m, flush=True)

    # ---- device ----------------------------------------------------------------------------------------------
    def fold(s, position, angle):
        """Folds/unfolds and turns the simulator through SpringBoard's display tool (fold/fold.m), then releases its
        test lock so the next call is not ignored."""
        r = sh("xcrun", "simctl", "spawn", s.udid, FOLD, f"-position={position}", f"-deviceOrientation={ORIENT[angle]}", "-wait", check=False)
        sh("xcrun", "simctl", "spawn", s.udid, FOLD, "-unlock", check=False)
        if r.returncode:
            s.why = f"fold.bin failed ({r.returncode}): {r.stderr.strip()[:200]}"
            return False
        s.position = position
        return True

    def display(s):
        return 3 if s.position == "open" else 1

    def screenshot(s, step):
        p = os.path.join(s.out, "shots", f"{step}.png")
        sh("xcrun", "simctl", "io", s.udid, "screenshot", f"--display={s.display()}", p, check=False)
        return p if os.path.exists(p) else None

    def record(s, step, display):
        p = os.path.join(s.out, "shots", f"{step}.mp4")
        proc = subprocess.Popen(["xcrun", "simctl", "io", s.udid, "recordVideo", "--codec=h264", f"--display={display}", "--force", p],
                                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        # recordVideo needs a moment before the first frame; wait for it to say so (or give up after 3s).
        end = time.time() + 3
        while time.time() < end and not (os.path.exists(p) and os.path.getsize(p) > 0):
            time.sleep(0.1)
        time.sleep(0.3)
        return proc, p, time.time() * 1000

    def stop_record(s, rec, at=None):
        """Stops the recording and tiles it (contact_sheet: from the video's own motion onset, not `at`)."""
        proc, p, t_rec = rec
        proc.send_signal(signal.SIGINT)
        try:
            proc.wait(10)
        except subprocess.TimeoutExpired:
            proc.kill()
        if not os.path.exists(p):
            return None
        return s.contact_sheet(p)

    @staticmethod
    def motion_onset(p):
        """Video time (s) the screen starts moving. simctl recordVideo is variable frame rate: it writes a frame only
        when the screen changes, and its timestamps are not wall-clock aligned (first frame at 0, the next one seconds
        later), so the wall clock cannot pick the window. The transition is the first burst: 5 frames within 0.5s
        (a lone clock or cursor tick is not one). None when the video never moves."""
        r = sh("ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "frame=pts_time", "-of", "csv=p=0", p, check=False)
        ts = sorted(float(x.strip(",")) for x in r.stdout.split() if x.strip(","))
        for i in range(1, len(ts) - 4):
            if ts[i + 4] - ts[i] <= 0.5:
                return ts[i]
        return None

    def contact_sheet(s, p):
        """3.2s from 0.3s before the motion onset at 10fps, one tile per 100ms, left to right, top to bottom. The fps
        filter repeats the last frame through the VFR gaps, which is what the screen showed."""
        sheet = p.replace(".mp4", "-frames.png")
        onset = s.motion_onset(p)
        ss = max(0.0, (onset or 0) - 0.3)
        sh("ffmpeg", "-loglevel", "error", "-y", "-i", p, "-vf",
           f"fps=10:start_time=0,trim=start={ss:.2f}:duration=3.2,setpts=PTS-STARTPTS,scale=360:-1,tile=8x4:padding=4:color=white",
           "-frames:v", "1", sheet, check=False)
        return sheet if os.path.exists(sheet) and os.path.getsize(sheet) > 0 else None

    # ---- one step ---------------------------------------------------------------------------------------------
    def step(s, sid, kind, tok, action, expect, desc, video=False, extra=None, check=None):
        """One action and its assessment. expect: a dict, or a function of the final sample's signals for a state
        with two valid windows (catalogue.expect: Safari's closed landscape tab, column or top bars)."""
        s.log(f"[{sid}] {desc}")
        http("POST", "/step", {"id": sid})
        prev = s.last  # the previous step's final placement and signals
        res = {"id": sid, "kind": kind, "desc": desc, "status": "PASS", "reasons": [], "notes": [],
               "expect": None if callable(expect) else expect,
               "prev": {"place": prev["place"], "key": prev["key"]} if prev else None, **(extra or {})}
        rec = s.record(sid, s.target_display) if (video or s.a.video) and getattr(s, "target_display", None) else None
        s.target_display = None
        t0 = time.time() * 1000
        s.why = "no sample from the page"
        first = action(sid, t0)
        if first is None:
            if rec:
                s.stop_record(rec)
            res.update(status="BLOCKED", reasons=["state not reached: " + s.why])
            s.finish(res, [], [], None)
            return res
        s.page = first.get("page")
        allr = s.collect(sid, tok, t0)
        if callable(expect):
            expect = res["expect"] = expect(allr[-1]["sig"] if allr else None)
        res["position"] = s.position
        native = s.native(kind, allr[-1]["sig"]["angle"] if allr else 0)
        shot = s.screenshot(sid)
        s.assess(res, allr, native, expect, t0, kind, prev)
        s.check_icons(res, shot)
        if check:
            s.verify(res, allr[-1] if allr else None, check, sid, tok, kind)
        sheet = s.stop_record(rec, t0 + (res.get("t") or {}).get("change", 0)) if rec else None
        if sheet:
            res["frames"] = os.path.relpath(sheet, s.out)
        s.finish(res, allr, native, shot)
        if allr:
            s.last = {"place": shown_place(allr[-1]), "key": key(allr[-1])}
            s.angle = allr[-1]["sig"]["angle"] if s.position == "closed" else s.angle
        return res

    def collect(s, sid, tok, t0):
        """Every sample of this step's page since the action began, until the signals have been quiet for QUIET_S
        (at least MIN_S, at most MAX_S)."""
        start = time.time()
        while True:
            time.sleep(0.25)
            allr = [r for r in samples(sid, t0) if mine(r, tok) and r.get("page") == s.page]
            el = time.time() - start
            if el >= MAX_S:
                break
            if el >= MIN_S and allr:
                k, quiet = key(allr[-1]), allr[-1]["rx"]
                for r in reversed(allr):
                    if key(r) != k:
                        break
                    quiet = r["rx"]
                if allr[-1]["rx"] - quiet >= QUIET_S * 1000:
                    break
        return allr

    def native(s, kind, angle=0):
        """Native button frames. Closed: the UI-test runner, in closed screen points. Unfolded: XCUITest frames on the
        inner display do not map (README), so the simulator helper describes the app by pid, in points of its window
        (the pane in split view), which works for either split pane."""
        bundle = PREVIEW_SVC if kind == "preview" else SAFARI
        if s.position != "open":
            r = cmd("elements", bundle=bundle)
            return (r or {}).get("elements", []) + (s.island(angle) if s.la_on else [])
        if not s.sim:
            s.native_why = "simulator helper missing"
            return []
        pid = s.sim.pid(bundle)
        if not pid:
            s.native_why = f"no running {bundle}"
            return []
        try:
            out = [e for e in s.sim.app_ui(pid) if e["type"] == "Button" or e["label"] == "Address"]
        except SimError as e:
            s.native_why = f"describe failed: {e}"
            return []
        s.native_why = None if out else f"{bundle} (pid {pid}) reported no buttons"
        return out

    @staticmethod
    def island(angle):
        """The Live Activity in the Dynamic Island as a native obstacle, measured live, not assumed: SpringBoard's
        jindo container for an activity. SpringBoard reports portrait device points (466x678); turned, they map to the
        page's screen points like its other windows (hidden-windows pill, round 5). None while the island shows no
        activity (it collapses to the bare sensor housing in closed landscape)."""
        r = cmd("tree", bundle=SPRINGBOARD)
        out = []
        for e in (r or {}).get("elements", []):
            if not (e["id"].startswith("jindo-container-view") and "activity:" in e["id"]):
                continue
            x, y, w, h = e["x"], e["y"], e["w"], e["h"]
            if angle == 90:
                x, y, w, h = y, 466 - x - w, h, w
            elif angle == 270:
                x, y, w, h = 678 - y - h, x, h, w
            out.append({"type": 0, "label": "Live Activity", "id": "island", "x": x, "y": y, "w": w, "h": h})
        return out

    # ---- assertions -------------------------------------------------------------------------------------------
    @staticmethod
    def origin(r, kind):
        """Page origin in screen points on the closed screen, measured against native button frames (README,
        Geometry): the web view starts after the native column at angle 90, a preview sheet is centred under its
        chrome, and WebKit offsets the layout viewport by the content inset (vv.x), so screen x = left + rect.x + vv.x."""
        g = r["sig"]
        W = max(g["screenWidth"], g["screenHeight"]) if g["angle"] in (90, 270) else min(g["screenWidth"], g["screenHeight"])
        H = g["screenHeight"] if W == g["screenWidth"] else g["screenWidth"]
        col = g["outerWidth"] - g["innerWidth"] if g["angle"] == 90 else 0
        vx = (r.get("vv") or {}).get("x", 0)
        if kind == "preview":
            return ((W - g["outerWidth"]) / 2 + col + vx, H - g["innerHeight"])
        # No column (page as wide as the window): Safari's bars sit above the page, as in the 678x340 landscape tab.
        top = g["outerHeight"] - g["innerHeight"] if g["outerWidth"] == g["innerWidth"] else 0
        return (col + vx, top)

    @staticmethod
    def origin_open(r, kind, native):
        """Page origin in window points on the unfolded screen (the frame native() reports in): a split pane's page
        sits beside Safari's column on the pane's outer edge (native Back on the right means the right pane, column
        right, page at 0); full screen Safari has its bars above the page; the preview sheet is centred with its bottom
        bar under the page. Returns (x0, y0, pane) where pane is "left", "right" or None."""
        g = r["sig"]
        back = next((e for e in native if e["label"] == "Back"), None)
        if is_split(g):
            pane = "right" if back and back["x"] > g["outerWidth"] / 2 else "left"
            return (g["outerWidth"] - g["innerWidth"] if pane == "left" else 0, 0, pane)
        if kind == "preview":
            W = 669 if g["outerHeight"] > 700 else INNER_W  # the tall posture's screen is 669 wide
            return ((W - g["outerWidth"]) / 2 if g["outerWidth"] < W else 0,
                    (back["y"] - g["innerHeight"]) if back else 0, None)
        return (g["outerWidth"] - g["innerWidth"] if back and back["x"] < 60 and g["outerWidth"] > g["innerWidth"] else 0,
                g["outerHeight"] - g["innerHeight"] if g["outerWidth"] == g["innerWidth"] else 0, None)

    def offscreen(s, r, kind):
        """Slots not fully on the screen. Closed: in screen points through origin() (the column Safari reserves is on
        screen, outside the page). Unfolded: inside the page's visible viewport [-vv.x, innerWidth - vv.x]."""
        g, vx, out = r["sig"], (r.get("vv") or {}).get("x", 0), []
        # Per sample, not per step: a fold or unfold step holds samples from both postures.
        closed = min(g["outerWidth"], g["outerHeight"]) <= 467 and max(g["outerWidth"], g["outerHeight"]) <= 679
        if closed:
            x0, y0 = s.origin(r, kind)
            W, H = g["screenWidth"], g["screenHeight"]
            if (g["innerWidth"] > g["innerHeight"]) != (W > H):
                W, H = H, W
            box = (-x0, -y0, W - x0, H - y0)
        elif is_split(g):
            col = g["outerWidth"] - g["innerWidth"]  # either copy may sit under the pane's column, beside the page
            box = (-col, 0, g["innerWidth"] + col, g["innerHeight"])
        else:
            box = (-vx, 0, g["innerWidth"] - vx, g["innerHeight"])
        for x in all_slots(r):
            q = x["rect"]
            if q["x"] < box[0] - 1 or q["y"] < box[1] - 1 or q["x"] + q["w"] > box[2] + 1 or q["y"] + q["h"] > box[3] + 1:
                out.append(f'{x["slot"]} at {q["x"] + (x0 if closed else 0):.0f},{q["y"]:.0f} off the {box[2] - box[0]:.0f}x{box[3] - box[1]:.0f} screen')
        return out

    @staticmethod
    def want(expect):
        return None if expect.get("hidden") else (expect.get("mode"), expect.get("side")) if expect.get("mode") else "any"

    def assess(s, res, allr, native, expect, t0, kind, prev):
        bad, note = res["reasons"], res["notes"]
        if prev:  # JSON (rerender) gives lists
            prev = {"place": tuple(prev["place"]) if prev["place"] else None, "key": tuple(prev["key"])}
        if not allr:
            res["status"] = "BLOCKED"; bad.append("no samples after the action"); return
        # 0. sampling
        gaps = [(b["rx"] - a["rx"]) for a, b in zip(allr, allr[1:])]
        big = [x for x in gaps if x > GAP_S * 1000]
        res["sample_ms"] = round(sorted(gaps)[len(gaps) // 2]) if gaps else None
        if big:
            note.append(f"{len(big)} sampling gaps over {GAP_S * 1000:.0f}ms (max {max(big)}ms)")
        # A backgrounded page (Safari behind the home screen or a split view menu, document.visibilityState hidden)
        # keeps laying out for the app switcher, at whatever window size it is handed, but nobody sees it: those
        # samples are not judged. Only the samples the user can see count.
        # The first render after the page is shown again (visibilitychange runs a task after the first paint) still has
        # the layout it was given while hidden: one render of it within GRACE_S is the return, not a flash.
        timeline = allr
        stale, last_hidden, back = set(), None, None
        for r in timeline:
            if r.get("visible") == "hidden":
                last_hidden, back = shown_place(r), None
                continue
            if last_hidden is not None and back is None:
                back = r["rx"]
            if back is not None and r["rx"] < back + GRACE_S * 1000 and shown_place(r) == last_hidden:
                stale.add(r["rx"])
            elif back is not None:
                last_hidden = None
        hidden = [r for r in allr if r.get("visible") == "hidden"]
        if hidden:
            note.append(f"{len(hidden)} samples while the page was hidden (backgrounded), not judged")
            allr = [r for r in allr if r.get("visible") != "hidden"]
            if not allr:
                res["status"] = "BLOCKED"; bad.append("the page stayed hidden after the action"); return
        if stale:
            note.append(f"{len(stale)} samples of the hidden layout in the first render after the page was shown again, not judged")
        last = allr[-1]
        g, n = last["sig"], nav(last)
        res["final"] = {"angle": g["angle"], "inner": f'{g["innerWidth"]}x{g["innerHeight"]}', "outer": f'{g["outerWidth"]}x{g["outerHeight"]}',
                        "inset": g["insetBottom"], "preview": last.get("preview"), "reason": last.get("reason"), "mode": n.get("mode"),
                        "side": n.get("side"), "hidden": n.get("hidden"), "shown": shown_place(last) is not None}
        res["samples_n"] = len(allr)
        want = s.want(expect)
        same = expect.get("same")  # angle 180: nothing changes, the previous placement stays
        if same and prev:
            want = prev["place"]
        ok = lambda p: p == want or (want == "any" and p is not None)
        # Phases: the old signals (prev key), transit, and the final signals (the trailing run of the last key).
        k_end = key(last)
        t_final = last["rx"]
        for r in reversed(allr):
            if key(r) != k_end:
                break
            t_final = r["rx"]
        t_change = next((r["rx"] for r in allr if prev and key(r) != prev["key"]), allr[0]["rx"])
        res["t"] = {"change": round(t_change - t0), "final": round(t_final - t0)}
        # 1. every sample: visible only in the old placement (before the signals change, plus one render), or in the
        # expected one; anywhere else is a flash, however short.
        flashes, cur = [], None
        for i, r in enumerate(timeline):  # hidden samples end a flash (nobody sees the page) but are not one
            p = None if r.get("visible") == "hidden" or r["rx"] in stale else shown_place(r)
            old = prev is not None and p == prev["place"] and (key(r) == prev["key"] or r["rx"] < t_change + GRACE_S * 1000)
            wrong = p is not None and not ok(p) and not old
            if wrong and cur is None:
                cur = {"place": p, "from": r["rx"], "key": key(r)}
            if not wrong and cur is not None:
                cur["ms"] = r["rx"] - cur["from"]; flashes.append(cur); cur = None
        if cur is not None:
            cur["ms"] = last["rx"] - cur["from"]; flashes.append(cur)
        for f in flashes[:4]:
            bad.append(f'flash: {f["place"][0]}/{f["place"][1]} shown for {f["ms"]}ms at +{f["from"] - t0:.0f}ms (signals {f["key"]})')
        # 2. every visible sample: slots inside the viewport (old-placement samples inside the grace render excepted:
        # their DOM still has the old layout against the new viewport).
        # The first sample after the viewport size changes is excepted too: the reporter reads the new size before the
        # chrome has re-rendered for it (pvu-tall, round 4: one sample of a 542pt-high page mid-turn, already hidden on
        # the next). A layout that stays off screen fails on the next sample.
        offs, lagged, size0 = [], 0, None
        for r in allr:
            p = shown_place(r)
            sz = (r["sig"]["innerWidth"], r["sig"]["innerHeight"], r["sig"]["outerWidth"], r["sig"]["outerHeight"])
            fresh = size0 is not None and sz != size0
            size0 = sz
            if p is None or r["rx"] in stale or (prev and p == prev["place"] and key(r) != prev["key"] and r["rx"] < t_change + GRACE_S * 1000):
                continue
            if fresh:
                lagged += bool(s.offscreen(r, kind))
                continue
            o = s.offscreen(r, kind)
            if o:
                offs.append((r["rx"] - t0, o[0]))
        if lagged:
            note.append(f"{lagged} samples off screen in the render right after a viewport resize, not judged")
        if offs:
            bad.append(f"off screen in {len(offs)} samples, first at +{offs[0][0]:.0f}ms: {offs[0][1]}")
        # 3. final state
        if "preview" in expect and last.get("preview") != expect["preview"]:
            bad.append(f'preview detected={last.get("preview")}, expected {expect["preview"]}')
        fp = shown_place(last)
        if not ok(fp):
            bad.append(f'final {"hidden" if fp is None else "/".join(map(str, fp))}, expected {"hidden" if want is None else "/".join(map(str, want)) if isinstance(want, tuple) else want}')
        if same:
            note.append(f"angle stays {g['angle']}: the page does not adopt upside down")
        # 4. settle: the final placement shows within SETTLE_S of the final signals and stays.
        t_ok = None
        for r in reversed(allr):
            if not ok(shown_place(r)):
                break
            t_ok = r["rx"]
        if t_ok is not None:
            res["settle_ms"] = round(max(0, t_ok - t_final))
            hid = [r["rx"] for r in allr if shown_place(r) is None]
            if hid and want is not None:
                res["hidden_ms"] = round(t_ok - hid[0]) if hid[0] < t_ok else 0
            if t_ok - t_final > SETTLE_S * 1000:
                bad.append(f"settled {(t_ok - t_final) / 1000:.2f}s after the final signals (> {SETTLE_S}s)")
            # 5. no slide: once in the final placement under the final signals, slot rects stop moving within SLIDE_S
            # (the same placement before the change, e.g. column/right at 270 then 0, has other rects by design).
            # A page change in the same placement (other slots or labels) springs from where it happens, for up to SPRING_S.
            if want is not None:
                t_ok, lim = max(t_ok, t_final), SLIDE_S
                rects = lambda r: {x["slot"]: x["rect"] for x in all_slots(r)}
                end = rects(last)
                content = lambda r: (sorted(rects(r)), sorted(l for l, _ in duet_buttons(r)))
                chg = [r for r in allr if r["rx"] >= t_ok and shown_place(r) is not None and content(r) != content(last)]
                if chg:
                    t_ok, lim = chg[-1]["rx"], SPRING_S
                fin = [r for r in allr if r["rx"] >= t_ok]
                moving = [r for r in fin if any(abs(r2[c] - end[sl][c]) > 2 for sl, r2 in rects(r).items() if sl in end for c in ("x", "y", "w", "h"))]
                if moving and moving[-1]["rx"] - t_ok > lim * 1000:
                    m = moving[0]
                    bad.append(f"slots slide for {moving[-1]['rx'] - t_ok:.0f}ms after showing (e.g. {rects(m)} -> {end})"[:300])
        # 6. native overlap and the preview gap, on the final sample. Closed: screen points. Unfolded: window points
        # (the pane in split view), only the slots inside the window (the far split copy is clipped by design).
        slots = []
        if fp is not None and s.position == "closed":
            x0, y0 = s.origin(last, kind)
            slots = [{"slot": x["slot"], "x": x["rect"]["x"] + x0, "y": x["rect"]["y"] + y0, "w": x["rect"]["w"], "h": x["rect"]["h"],
                      "icons": [{**i, "x": i["x"] + x0, "y": i["y"] + y0} for i in x["icons"]]} for x in all_slots(last)]
        elif fp is not None and native:
            x0, y0, pane = s.origin_open(last, kind, native)
            res["pane"] = pane
            ww, wh = g["outerWidth"], g["outerHeight"]
            slots = [{"slot": x["slot"], "x": x["rect"]["x"] + x0, "y": x["rect"]["y"] + y0, "w": x["rect"]["w"], "h": x["rect"]["h"],
                      "icons": [{**i, "x": i["x"] + x0, "y": i["y"] + y0} for i in x["icons"]]} for x in all_slots(last)]
            slots = [sl for sl in slots if sl["x"] + sl["w"] > 0 and sl["x"] < ww and sl["y"] < wh]
            for sl in slots:
                if sl["x"] < -1 or sl["x"] + sl["w"] > ww + 1 or sl["y"] < -1 or sl["y"] + sl["h"] > wh + 1:
                    bad.append(f'{sl["slot"]} cut by the window edge at {sl["x"]:.0f},{sl["y"]:.0f} ({ww}x{wh} window)')
            if is_split(g):
                if len(slots) < 2:
                    bad.append(f"split view, {pane} pane: fewer than two Duet controls visible in the pane")
                if pane != s.split:
                    note.append(f"native Back puts Safari in the {pane} pane, the driver expected {s.split}")
        elif s.position == "open":
            note.append(f"unfolded: no native frames ({getattr(s, 'native_why', None) or 'none found'}), overlap not checked")
        if slots:
            for sl in slots:
                for e in native:
                    if e["label"] == "Address" and e["w"] > 200:
                        continue
                    ix = min(sl["x"] + sl["w"], e["x"] + e["w"]) - max(sl["x"], e["x"])
                    iy = min(sl["y"] + sl["h"], e["y"] + e["h"]) - max(sl["y"], e["y"])
                    if ix > 2 and iy > 2:
                        bad.append(f'{sl["slot"]} overlaps native "{e["label"]}" by {ix:.0f}x{iy:.0f}')
        res["slots"] = slots
        if expect.get("gap") and slots:
            col = [e for e in native if e["w"] <= 60]
            above = [e for e in col if e["label"] in ("Page Menu", "Cancel", "Done", "Close")]
            below = [e for e in col if e["label"] == "Back"]
            if above and below:
                cx, cx2 = min(e["x"] for e in col) - 8, max(e["x"] + e["w"] for e in col) + 8
                top, bot = max(e["y"] + e["h"] for e in above), min(e["y"] for e in below)
                res["gap"] = {"x": cx, "x2": cx2, "top": top, "bottom": bot, "h": bot - top}
                for sl in slots:
                    if not (sl["x"] >= cx and sl["x"] + sl["w"] <= cx2 and sl["y"] >= top - 1 and sl["y"] + sl["h"] <= bot + 1):
                        bad.append(f'{sl["slot"]} not in the preview column gap (x {cx:.0f}..{cx2:.0f}, y {top:.0f}..{bot:.0f}), at {sl["x"]:.0f},{sl["y"]:.0f}')
            else:
                bad.append("preview column buttons not found, gap not measured")
        # Turned default/full preview: the strip sits in the 84pt safe-area band, below the native top bar.
        if expect.get("preview") and expect.get("mode") == "strip" and slots:
            bar = [e for e in native if e["y"] + e["h"] <= 90 and e["h"] <= 60]
            if not bar:
                note.append("preview top bar buttons not found, band clearance checked by overlap only")
            floor = max((e["y"] + e["h"] for e in bar), default=0)
            for sl in slots:
                if sl["y"] < floor - 1:
                    bad.append(f'{sl["slot"]} above the preview top bar bottom ({floor:.0f}), at y {sl["y"]:.0f}')
        # 7. overflow / clipping / content under controls, on the final sample
        sx, W0 = last["scroll"]["x"], last["scroll"]["clientWidth"]
        lo, hi = min(0, -sx), max(W0, W0 - sx)
        # span.duet-guard straddles the column edge 8pt past the window by design (duet.css, #79): transparent, no
        # taps, adds no scroll width, so it is not an overflowing block.
        overs = []
        for o in last.get("overflow", []):
            ov = round(max(o["rect"]["x"] + o["rect"]["w"] - hi, lo - o["rect"]["x"]))
            if ov > 1:
                overs.append({**o, "over": ov})
        for o in [o for o in overs if o["text"]][:4]:
            bad.append(f'clipped text {o["el"][:60]} by {o["over"]}pt')
        for o in [o for o in overs if not o["text"] and not o["el"].startswith(("div.duet-scroller", "main", "section.stage", "span.duet-guard"))][:3]:
            bad.append(f'overflowing block {o["el"][:60]} by {o["over"]}pt')
        if last["scroll"]["scrollWidth"] > W0:
            note.append(f"scrollWidth {last['scroll']['scrollWidth']} > {W0} (column bleed, documented)")
        for u in last.get("underControls", [])[:3]:
            bad.append(f'content under Duet control: {u["el"][:60]}')
        if bad:
            res["status"] = "FAIL"

    def finish(s, res, allr, native, shot):
        res["native"] = native
        res["shot"] = os.path.relpath(shot, s.out) if shot else None
        if shot:
            res["overlay"] = s.overlay(res, shot)
        with open(os.path.join(s.out, "steps", res["id"] + ".json"), "w") as f:
            json.dump({**res, "samples": allr}, f)
        s.results.append(res)
        s.log(f"  {res['status']} " + "; ".join(res["reasons"]) + (f"  [{'; '.join(res['notes'])}]" if res["notes"] else ""))

    def frame(s, res, shot):
        """The screenshot turned upright, and the map from slot points (screen or window) to its pixels."""
        from PIL import Image
        im = Image.open(shot).convert("RGB")
        a = (res.get("final") or {}).get("angle", 0)
        opened = res.get("position") == "open"
        if not opened and res.get("slots") and a in (90, 270) and im.width < im.height:
            im = im.rotate(-90 if a == 90 else 90, expand=True)
        if opened:  # unfolded: window points; a right split pane starts after the left pane and the divider
            k = im.width / (INNER_W if im.width > im.height else 669)
            dx = INNER_W - 469 if res.get("pane") == "right" else 0
        else:
            k, dx = im.width / (678 if im.width > im.height else 466), 0
        return im, (lambda r: [(r["x"] + dx) * k, r["y"] * k, (r["x"] + dx + r["w"]) * k, (r["y"] + r["h"]) * k])

    def check_icons(s, res, shot):
        """Every icon a visible slot draws must be painted: its crop in the final screenshot has contrast (an icon
        stroke on glass), not one flat colour. Catches a pill whose unselected tab icons never painted (round 3)."""
        if not shot or res.get("status") == "BLOCKED" or not res.get("slots"):
            return
        try:
            from PIL import ImageStat
            im, box = s.frame(res, shot)
        except Exception as e:  # noqa: BLE001
            res["notes"].append(f"icons not checked ({e})"); return
        blank, n = [], 0
        for sl in res["slots"]:
            for i in sl.get("icons", []):
                b = [round(v) for v in box(i)]
                if b[0] < 0 or b[1] < 0 or b[2] > im.width or b[3] > im.height or b[2] - b[0] < 4 or b[3] - b[1] < 4:
                    continue
                n += 1
                sd = ImageStat.Stat(im.crop(b).convert("L")).stddev[0]
                i["sd"] = round(sd, 1)
                if sd < ICON_SD:
                    blank.append(f'{sl["slot"]} icon at {i["x"]:.0f},{i["y"]:.0f} (sd {sd:.1f})')
        res["icons"] = n
        if blank:
            res["reasons"].append(f"{len(blank)} of {n} icons not painted: " + ", ".join(blank[:4]))
            res["status"] = "FAIL"

    def overlay(s, res, shot):
        """Draws Duet's slots (red), native buttons (blue) and the preview gap (green) on the screenshot."""
        try:
            from PIL import ImageDraw
        except ImportError:
            return None
        im, box = s.frame(res, shot)
        d = ImageDraw.Draw(im)
        for e in res.get("native", []):
            d.rectangle(box(e), outline=(40, 120, 255), width=5)
        if res.get("gap"):
            gp = res["gap"]
            d.rectangle(box({"x": gp["x"], "y": gp["top"], "w": gp["x2"] - gp["x"], "h": gp["bottom"] - gp["top"]}), outline=(0, 200, 80), width=5)
        for sl in res.get("slots", []):
            d.rectangle(box(sl), outline=(255, 40, 40), width=6)
            for i in sl.get("icons", []):
                d.rectangle(box(i), outline=(255, 200, 0), width=2)
        p = shot.replace(".png", "-overlay.png")
        im.thumbnail((1400, 1400))
        im.save(p)
        return os.path.relpath(p, s.out)

    # ---- drivers ----------------------------------------------------------------------------------------------
    def url(s, tok):
        """The page, reporting to this run's beacon (one per simulator in a parallel run, matrix.sh)."""
        return f"{SITE}{s.page_path}?e2e={urllib.parse.quote(BEACON, safe='')}&s={tok}"

    def host(s, *args, fresh=False):
        """Launches the e2e host app (fresh: quit it first), pointed at this run's beacon (Live.swift)."""
        return sh("xcrun", "simctl", "launch", *(["--terminate-running-process"] if fresh else []), s.udid, HOST,
                  "-beacon", BEACON, *args, check=fresh)

    def wait(s, sid, tok, cond, t0, timeout=STATE_TIMEOUT, page=None):
        end = time.time() + timeout
        while time.time() < end:
            for r in samples(sid, t0):
                if mine(r, tok) and (page is None or r.get("page") == page) and cond(r):
                    return r
            time.sleep(0.1)
        return None

    def open_tab(s, tok):
        def act(sid, t0):
            sh("xcrun", "simctl", "openurl", s.udid, s.url(tok))
            return s.wait(sid, tok, lambda r: not r.get("preview"), t0)
        return act

    def open_preview(s, tok, style):
        def act(sid, t0):
            s.host("-url", s.url(tok), "-style", style, fresh=True)
            return s.wait(sid, tok, lambda r: True, t0)
        return act

    def turn(s, tok, position, angle, cond, label, after=False):
        """Folds/turns with fold.bin, then waits for a sample of the same page that satisfies cond (after: taken once
        fold.bin returned, which waits for the turn, for a state whose window the one before it may match too)."""
        def act(sid, t0):
            page = s.page
            if not s.fold(position, angle):
                return None
            done = time.time() * 1000
            r = s.wait(sid, tok, (lambda r: r["rx"] >= done and cond(r)) if after else cond, t0, page=page)
            if r is None:
                s.why = f"{label} not reported by the page in {STATE_TIMEOUT}s"
            return r
        s.target_display = 3 if position == "open" else 1
        return act

    def rotate(s, tok, angle):
        return s.turn(tok, "closed", angle, lambda r: r["sig"]["angle"] == angle and r["sig"]["outerWidth"] < 700, f"angle {angle}")

    def upside_down(s, tok):
        """Angle 180: Safari and the preview do not adopt it on the Duo. Turn, give it 1.5s, take the last sample."""
        def act(sid, t0):
            page = s.page
            if not s.fold("closed", 180):
                return None
            time.sleep(1.5)
            rs = [r for r in samples(sid, t0) if mine(r, tok) and r.get("page") == page]
            return rs[-1] if rs else None
        s.target_display = 1
        return act

    def unfold(s, tok, angle=0, preview=False):
        # On the inner display "portrait" (0) is the wide 951x669 window, a quarter turn is the tall 669x951 one.
        wide = angle in (0, 180)
        if preview:  # the preview's sheet unfolded: a window of its own (653x661 wide), larger than the closed screen
            return s.turn(tok, "open", angle, lambda r: min(r["sig"]["outerWidth"], r["sig"]["outerHeight"]) > 500,
                          f"unfolded preview sheet ({'wide' if wide else 'tall'})", after=True)
        return s.turn(tok, "open", angle, lambda r: (r["sig"]["outerWidth"] > 900) == wide and max(r["sig"]["outerWidth"], r["sig"]["outerHeight"]) > 900,
                      f"unfolded {'951x669' if wide else '669x951'}")

    def fold_closed(s, tok, angle=0):
        return s.turn(tok, "closed", angle, lambda r: max(r["sig"]["outerWidth"], r["sig"]["outerHeight"]) < 700, f"closed at {angle}")

    def open_in_safari(s, tok):
        def act(sid, t0):
            r = cmd("tap", bundle=PREVIEW_SVC, label="Open in Safari")
            if not r or not r.get("ok"):
                s.why = f"tap Open in Safari failed: {r}"
                return None
            gone = s.page  # the preview's document keeps reporting while it is dismissed: follow the new tab's
            return s.wait(sid, tok, lambda r: r.get("page") != gone and not r.get("preview"), t0)
        s.last = None  # a new document: no old placement to keep
        s.target_display = 1
        return act

    def la_state(s, on, since, timeout=15):
        """Waits for the host to report the wanted Live Activity state after `since` (ms)."""
        end = time.time() + timeout
        while time.time() < end:
            st = http("GET", "/la/state") or {}
            if st.get("at", 0) >= since and bool(st.get("count")) == on:
                return st
            time.sleep(0.2)
        return None

    def la(s, tok, on, kind):
        """Starts or ends the host's music Live Activity (host/Host/Live.swift) with the page in front. In the preview
        the host is the app in front, so its poll starts the activity under the open sheet. In a Safari tab ActivityKit
        will not start one from the background: the host comes forward (no URL scheme, which would prompt) and Safari
        goes back in front, as a user does after starting music elsewhere; the tab is not reloaded. Ending works from
        the background. Waits for a sample taken after the island settled."""
        def act(sid, t0):
            page, since = s.page, time.time() * 1000
            http("POST", "/la", {"on": on})
            fwd = on and kind == "tab"
            if fwd:
                s.host()
            st = s.la_state(on, since)
            if fwd:
                sh("xcrun", "simctl", "launch", s.udid, SAFARI, check=False)
            if st is None:
                s.why = f"Live Activity not {'started' if on else 'ended'} in 15s: {http('GET', '/la/state')}"
                return None
            s.la_on = on
            time.sleep(1.0)  # the island grows or shrinks, and Safari's buttons move with it
            done = time.time() * 1000
            r = s.wait(sid, tok, lambda r: r["rx"] >= done, t0, page=page)
            if r is None:
                s.why = "the page stopped reporting after the Live Activity changed"
            return r
        s.target_display = s.display()
        return act

    # ---- split view (simulator helper; README, Split view) --------------------------------------------------------
    def sb_tap(s, ident, hold=0.0, tries=6, page=False):
        """Taps (or long-presses) a SpringBoard element found by accessibility identifier. page: an app icon, which may
        be on another Home Screen page (HOME lands on whichever page was last shown, the widgets page included), so a
        miss turns the page: forward twice, then back."""
        for i in range(tries):
            pt = s.sim.springboard_find(ident)
            if pt:
                s.sim.tap(*pt, hold=hold)
                return True
            if page:
                lit = s.sim.lit()
                w, h = lit["pointWidth"], lit["pointHeight"]
                if lit.get("quarterTurns", 0) % 2:
                    w, h = h, w
                a, b = (w * 0.75, w * 0.25) if i % 4 < 2 else (w * 0.25, w * 0.75)
                s.sim.drag(a, h * 0.45, b, h * 0.45, ms=300, steps=10, end_hold_ms=50)
                time.sleep(0.8)
            else:
                time.sleep(0.5)
        s.why = f"SpringBoard element {ident!r} not found"
        return False

    def open_in_split(s, icon):
        """Home, long-press an app icon, "Open in Split View": that app takes the left pane, home shows on the right."""
        s.sim.button("HOME")
        time.sleep(1.5)
        if not s.sb_tap(icon, hold=1.5, page=icon != SB_SAFARI):  # Safari is in the dock, on every page
            return False
        time.sleep(1.0)
        if not s.sb_tap(SB_SPLIT):
            s.sim.button("HOME")
            return False
        time.sleep(1.5)
        return True

    def to_split(s, tok, pane):
        """Safari's tab into the left pane (long-press Safari, Open in Split View, then our host on the right) or the
        right pane (long-press our host, Open in Split View, then Safari from the dock). Both keep Safari's window and
        its document. From a pane, the host is quit first: "Open in Split View" on an app of a live pair brings the same pair back
        (e2e round 3), so a move between panes is split -> Safari full width -> split on the other side. Waits for the 469x669 pane."""
        def act(sid, t0):
            page = s.page
            if not s.sim:
                s.why = "simulator helper missing (sim.py)"
                return None
            try:
                if s.split:  # SpringBoard restores a live pair as it was: quit the host so Safari can take the other pane
                    sh("xcrun", "simctl", "terminate", s.udid, HOST, check=False)
                    time.sleep(1.5)
                if pane == "left":
                    if not s.open_in_split(SB_SAFARI):
                        return None
                    s.host()
                else:
                    if not s.open_in_split(SB_HOST):
                        return None
                    if not s.sb_tap(SB_SAFARI):
                        return None
            except SimError as e:
                s.why = str(e)
                return None
            r = s.wait(sid, tok, lambda r: is_split(r["sig"]), t0, page=page, timeout=15)
            if r is None:
                s.why = f"Safari did not report a 469x669 split pane ({pane}) in 15s"
                return None
            time.sleep(0.5)
            got = s.origin_open(r, "tab", s.native("tab"))[2]
            s.split = got
            if got != pane:
                s.why = f"Safari landed in the {got} pane, not the {pane} pane"
                return None
            # Focus Safari's pane (a tap on the page's title, beside its column): the focused app is the one that keeps
            # the screen when the tall posture or the fold drops split view; unfocused, the other app takes it.
            try:
                s.sim.tap(84 + 192 if pane == "left" else INNER_W - 469 + 192, 150)
            except SimError:
                pass
            return r
        s.target_display = 3
        return act

    def swap_drag(s, tok):
        """Direct pane swap, no detour through full width: drag Safari's pane by its top edge handle over the other
        pane. Dumps the lit display's accessibility tree first (split-handle.json) so a missed handle can be found."""
        def act(sid, t0):
            page, frm = s.page, s.split
            try:
                with open(os.path.join(s.out, "steps", f"{sid}-ui.json"), "w") as f:
                    json.dump(s.sim.ui(), f)
                x = 234 if frm == "left" else INNER_W - 234
                s.sim.drag(x, 8, INNER_W - x, 330, hold_ms=600, ms=900, end_hold_ms=400)
            except SimError as e:
                s.why = str(e)
                return None
            want = "right" if frm == "left" else "left"
            end = time.time() + 12
            while time.time() < end:
                r = s.wait(sid, tok, lambda r: is_split(r["sig"]), t0, page=page, timeout=2)
                if r is not None and s.origin_open(r, "tab", s.native("tab"))[2] == want:
                    s.split = want
                    return r
            s.why = f"dragging the {frm} pane's top handle did not move Safari to the {want} pane"
            return None
        s.target_display = 3
        return act

    def split_to_full(s, tok):
        """Drags the divider to the far edge so Safari's pane takes the whole screen."""
        def act(sid, t0):
            page = s.page
            x, y = DIVIDER
            try:
                s.sim.drag(x, y, INNER_W - 10 if s.split == "left" else 10, y, hold_ms=300, ms=700)
            except SimError as e:
                s.why = str(e)
                return None
            r = s.wait(sid, tok, lambda r: r["sig"]["outerWidth"] > 900, t0, page=page, timeout=15)
            if r is None:
                s.why = "Safari did not report the full 951pt window in 15s after the divider drag"
            else:
                s.split = None
            return r
        s.target_display = 3
        return act

    def split_turn(s, tok, angle):
        """Turns the unfolded device to the tall posture from split view. Split view does not exist there: one app
        takes the screen: the focused one (to_split leaves Safari focused). Passes when Safari reports the full 669x951 window."""
        def act(sid, t0):
            page = s.page
            if not s.fold("open", angle):
                return None
            r = s.wait(sid, tok, lambda r: r["sig"]["outerWidth"] < 700 and r["sig"]["outerHeight"] > 900, t0, page=page, timeout=12)
            if r is None:
                s.why = f"split view dropped in the tall posture ({angle}) and the other app took the screen: Safari stopped reporting"
            s.split = None
            return r
        s.target_display = 3
        return act

    def reset(s):
        """Every scenario starts closed, in portrait, with Safari in front, the host preview gone and no Live Activity
        (the host ends it first: an activity outlives its app)."""
        since = time.time() * 1000
        http("POST", "/la", {"on": False})
        if (http("GET", "/la/state") or {}).get("count") and not s.la_state(False, since, timeout=3):
            s.host()
            s.la_state(False, since)
        s.la_on = False
        sh("xcrun", "simctl", "terminate", s.udid, HOST, check=False)
        if s.split and s.position == "open" and s.sim:  # leave split view: Safari full screen again
            try:
                s.sim.drag(*DIVIDER, INNER_W - 10 if s.split == "left" else 10, DIVIDER[1], hold_ms=300, ms=700)
            except SimError:
                pass
        s.fold("closed", 0)
        s.position, s.angle, s.last, s.split = "closed", 0, None, None
        time.sleep(1)

    # ---- scenarios --------------------------------------------------------------------------------------------
    def tok(s, name):
        return f"{name}{int(time.time())}"

    def scenario_tab(s):
        t = s.tok("tab")
        s.step("tab-0", "tab", t, s.open_tab(t), {"preview": False, "mode": "column", "side": "right"}, "Safari tab, closed, portrait")
        for a in PATH:
            frm = s.angle
            s.step(f"tab-{frm}to{a}", "tab", t, s.rotate(t, a), {"preview": False, "mode": TAB[a][0], "side": TAB[a][1]}, f"Safari tab, turn {frm} -> {a}", video=True)
        s.step("tab-0to180", "tab", t, s.upside_down(t), {"preview": False, "same": True}, "Safari tab, turn upside down (180)", video=True)
        s.step("tab-180to0", "tab", t, s.rotate(t, 0), {"preview": False, "mode": "column", "side": "right"}, "Safari tab, back to portrait")

    def scenario_preview(s, style):
        t = s.tok(f"pv{style}")
        s.step(f"preview-{style}-0", "preview", t, s.open_preview(t, style), preview_expect(style, 0), f"in-app preview ({style}), portrait")
        for a in [90, 270, 0]:
            frm = s.angle
            s.step(f"preview-{style}-{frm}to{a}", "preview", t, s.rotate(t, a), preview_expect(style, a), f"in-app preview ({style}), turn {frm} -> {a}", video=True)

    def scenario_open_safari(s, angle):
        t = s.tok(f"pvos{angle}")
        s.step(f"openinsafari-{angle}-preview", "preview", t, s.open_preview(t, "sheet"), {"preview": True, **PREVIEW[0]}, "in-app preview (sheet) before Open in Safari")
        if angle:
            s.step(f"openinsafari-{angle}-turn", "preview", t, s.rotate(t, angle), {"preview": True, **PREVIEW[angle]}, f"in-app preview (sheet), turn to {angle}")
        exp = TAB[angle]
        s.step(f"openinsafari-{angle}-tab", "tab", t, s.open_in_safari(t), {"preview": False, "mode": exp[0], "side": exp[1]}, f"preview at {angle} -> Open in Safari -> Safari tab", video=True)

    def scenario_fold(s):
        t = s.tok("fold")
        s.step("fold-closed-0", "tab", t, s.open_tab(t), {"preview": False, "mode": "column", "side": "right"}, "Safari tab, closed, portrait")
        s.step("fold-unfold", "tab", t, s.unfold(t, 0), {"preview": False, **UNFOLDED}, "unfold: closed portrait -> open full width", video=True)
        s.step("fold-open-tall-90", "tab", t, s.unfold(t, 90), {"preview": False, **UNFOLDED}, "unfolded, turn to the tall window (669x951)", video=True)
        s.step("fold-open-tall-270", "tab", t, s.unfold(t, 270), {"preview": False, **UNFOLDED}, "unfolded, turn the other way (669x951)", video=True)
        s.step("fold-open-wide", "tab", t, s.unfold(t, 0), {"preview": False, **UNFOLDED}, "unfolded, back to the wide window (951x669)", video=True)
        s.step("fold-fold", "tab", t, s.fold_closed(t, 0), {"preview": False, "mode": "column", "side": "right"}, "fold: open -> closed portrait", video=True)
        s.step("fold-closed-90", "tab", t, s.rotate(t, 90), {"preview": False, "mode": "column", "side": "left"}, "closed, turn to 90")
        s.step("fold-unfold-from-90", "tab", t, s.unfold(t, 90), {"preview": False, **UNFOLDED}, "unfold from closed 90", video=True)
        s.step("fold-fold-to-90", "tab", t, s.fold_closed(t, 90), LANDSCAPE_TOP_BARS, "fold back to closed 90 (Safari keeps its top bars, no column)", video=True)
        s.step("fold-unfold-from-90b", "tab", t, s.unfold(t, 0), {"preview": False, **UNFOLDED}, "unfold from closed 90 into the wide window", video=True)
        s.step("fold-fold-to-270", "tab", t, s.fold_closed(t, 270), LANDSCAPE_TOP_BARS, "fold into closed 270 (Safari keeps its top bars, no column)", video=True)
        s.step("fold-270to0", "tab", t, s.rotate(t, 0), {"preview": False, "mode": "column", "side": "right"}, "closed 270 after the fold, turn to portrait", video=True)

    def scenario_split(s):
        """Split view in every way the user moves through it, wide inner display (the only posture with split view)."""
        t = s.tok("split")
        s.step("split-tab", "tab", t, s.open_tab(t), {"preview": False, "mode": "column", "side": "right"}, "Safari tab, closed, portrait")
        s.step("split-unfold", "tab", t, s.unfold(t, 0), {"preview": False, **UNFOLDED}, "unfold into the wide window", video=True)
        s.step("split-left", "tab", t, s.to_split(t, "left"), {"preview": False, **SPLIT}, "full width -> split view, Safari in the left pane", video=True)
        s.step("split-swap-right", "tab", t, s.to_split(t, "right"), {"preview": False, **SPLIT}, "move Safari to the right pane", video=True)
        s.step("split-swap-left", "tab", t, s.to_split(t, "left"), {"preview": False, **SPLIT}, "move Safari back to the left pane", video=True)
        s.step("split-left-to-full", "tab", t, s.split_to_full(t), {"preview": False, **UNFOLDED}, "left pane -> full width (divider to the right edge)", video=True)
        s.step("split-right", "tab", t, s.to_split(t, "right"), {"preview": False, **SPLIT}, "full width -> split view, Safari in the right pane", video=True)
        s.step("split-right-to-full", "tab", t, s.split_to_full(t), {"preview": False, **UNFOLDED}, "right pane -> full width (divider to the left edge)", video=True)

    def scenario_split_drag(s):
        """Experimental: a direct pane swap by dragging the pane's top handle (scenario split moves through full width)."""
        t = s.tok("splitdrag")
        s.step("splitdrag-tab", "tab", t, s.open_tab(t), {"preview": False, "mode": "column", "side": "right"}, "Safari tab, closed, portrait")
        s.step("splitdrag-unfold", "tab", t, s.unfold(t, 0), {"preview": False, **UNFOLDED}, "unfold into the wide window")
        s.step("splitdrag-left", "tab", t, s.to_split(t, "left"), {"preview": False, **SPLIT}, "split view, Safari in the left pane")
        s.step("splitdrag-to-right", "tab", t, s.swap_drag(t), {"preview": False, **SPLIT}, "drag Safari's pane onto the right pane", video=True)
        s.step("splitdrag-to-left", "tab", t, s.swap_drag(t), {"preview": False, **SPLIT}, "drag Safari's pane back onto the left pane", video=True)

    def scenario_split_turn(s):
        """Turning and folding from split view: the tall posture and the closed screen have no split view."""
        t = s.tok("splitturn")
        s.step("splitturn-tab", "tab", t, s.open_tab(t), {"preview": False, "mode": "column", "side": "right"}, "Safari tab, closed, portrait")
        s.step("splitturn-unfold", "tab", t, s.unfold(t, 0), {"preview": False, **UNFOLDED}, "unfold into the wide window")
        for pane, a in (("left", 90), ("right", 270)):
            s.step(f"splitturn-{pane}", "tab", t, s.to_split(t, pane), {"preview": False, **SPLIT}, f"split view, Safari in the {pane} pane")
            s.step(f"splitturn-{pane}-to{a}", "tab", t, s.split_turn(t, a), {"preview": False, **UNFOLDED}, f"{pane} pane, turn to the tall posture ({a}): one app full screen", video=True)
            s.step(f"splitturn-{pane}-wide", "tab", t, s.unfold(t, 0), {"preview": False, **UNFOLDED}, "back to the wide window", video=True)
        s.step("splitturn-split-fold", "tab", t, s.to_split(t, "right"), {"preview": False, **SPLIT}, "split view, Safari in the right pane, before folding")
        s.step("splitturn-fold", "tab", t, s.fold_closed(t, 0), {"preview": False, "mode": "column", "side": "right"}, "fold from split view to the closed screen", video=True)

    def scenario_live(s, style):
        """A music Live Activity in the Dynamic Island (host/Host/Live.swift) on one surface: Safari tab or an in-app
        preview style. Started and ended at every closed angle and turned with it running, then unfolded and folded
        with it running. The island is a native obstacle measured from SpringBoard on every closed step (island()),
        so a control under it or under a button it pushed fails check 6. Every step is filmed; the clips of the
        scenario are stitched into one film (report)."""
        tab = style == "tab"
        kind = "tab" if tab else "preview"
        t = s.tok(f"live{style}")
        exp = (lambda a: {"preview": False, "mode": TAB[a][0], "side": TAB[a][1]}) if tab else (lambda a: preview_expect(style, a))
        name = "Safari tab" if tab else f"preview ({style})"
        p = f"live-{style}"
        s.step(f"{p}-open", kind, t, s.open_tab(t) if tab else s.open_preview(t, style), exp(0), f"{name}: open, no Live Activity", video=True)
        s.step(f"{p}-on-0", kind, t, s.la(t, True, kind), exp(0), f"{name}: Live Activity starts at 0", video=True)
        for a in (90, 270, 0):
            frm = s.angle
            s.step(f"{p}-on-{frm}to{a}", kind, t, s.rotate(t, a), exp(a), f"{name} with Live Activity: turn {frm} -> {a}", video=True)
        s.step(f"{p}-off-0", kind, t, s.la(t, False, kind), exp(0), f"{name}: Live Activity ends at 0", video=True)
        for a in (90, 270):
            s.step(f"{p}-to{a}", kind, t, s.rotate(t, a), exp(a), f"{name}: turn to {a}", video=True)
            s.step(f"{p}-on-{a}", kind, t, s.la(t, True, kind), exp(a), f"{name}: Live Activity starts at {a}", video=True)
            s.step(f"{p}-off-{a}", kind, t, s.la(t, False, kind), exp(a), f"{name}: Live Activity ends at {a}", video=True)
        s.step(f"{p}-to0", kind, t, s.rotate(t, 0), exp(0), f"{name}: back to 0", video=True)
        s.step(f"{p}-on-0b", kind, t, s.la(t, True, kind), exp(0), f"{name}: Live Activity starts again", video=True)
        s.step(f"{p}-on-unfold", kind, t, s.unfold(t, 0, preview=not tab), UNFOLDED_PREVIEW if not tab else {"preview": False, **UNFOLDED},
               f"{name} with Live Activity: unfold", video=True)
        s.step(f"{p}-on-fold", kind, t, s.fold_closed(t, 0), exp(0), f"{name} with Live Activity: fold", video=True)
        s.step(f"{p}-off-end", kind, t, s.la(t, False, kind), exp(0), f"{name}: Live Activity ends", video=True)

    def scenario_preview_unfolded(s):
        """The in-app preview across the unfold: opened closed then unfolded, turned, folded back, and opened unfolded.
        Unfolded, the sheet is a 653x661 window centred on the wide screen with its bars above and below the page,
        no column: Duet goes inline on the default side, like full width Safari (EXPECTED.md, unfolded)."""
        t = s.tok("pvu")
        s.step("pvu-closed", "preview", t, s.open_preview(t, "sheet"), {"preview": True, **PREVIEW[0]}, "in-app preview (sheet), closed portrait")
        s.step("pvu-unfold", "preview", t, s.unfold(t, 0, preview=True), dict(UNFOLDED_PREVIEW), "unfold with the preview open", video=True)
        s.step("pvu-tall", "preview", t, s.unfold(t, 90, preview=True), dict(UNFOLDED_PREVIEW), "preview unfolded, turn to the tall posture", video=True)
        s.step("pvu-wide", "preview", t, s.unfold(t, 0, preview=True), dict(UNFOLDED_PREVIEW), "preview unfolded, back to the wide posture", video=True)
        s.step("pvu-fold", "preview", t, s.fold_closed(t, 0), {"preview": True, **PREVIEW[0]}, "fold with the preview open", video=True)
        s.reset()
        s.fold("open", 0)
        time.sleep(1.5)
        t = s.tok("pvuo")
        s.step("pvu-open-unfolded", "preview", t, s.open_preview(t, "sheet"), dict(UNFOLDED_PREVIEW), "in-app preview opened while unfolded")
        s.step("pvu-open-unfolded-fold", "preview", t, s.fold_closed(t, 0), {"preview": True, **PREVIEW[0]}, "fold the preview opened unfolded", video=True)

    def scenario_open_safari_unfold(s):
        t = s.tok("pvosu")
        s.step("openinsafari-unfold-preview", "preview", t, s.open_preview(t, "sheet"), {"preview": True, **PREVIEW[0]}, "in-app preview (sheet), closed portrait")
        s.step("openinsafari-unfold-tab", "tab", t, s.open_in_safari(t), {"preview": False, "mode": "column", "side": "right"}, "Open in Safari from the outer screen", video=True)
        s.step("openinsafari-unfold", "tab", t, s.unfold(t, 0), {"preview": False, **UNFOLDED}, "then unfold", video=True)
        s.step("openinsafari-unfold-split", "tab", t, s.to_split(t, "left"), {"preview": False, **SPLIT}, "then split view, left pane", video=True)

    def scenario_dynamic_type(s):
        """PREVIEW.gap variant: the preview's column with the largest accessibility text size. Its buttons are fixed
        size controls, so the gap should not move; the step proves Duet still fits it (the island grown by a Live
        Activity: the live-* scenarios)."""
        before = sh("xcrun", "simctl", "ui", s.udid, "content_size", check=False).stdout.strip() or "large"
        sh("xcrun", "simctl", "ui", s.udid, "content_size", "accessibility-extra-extra-extra-large", check=False)
        try:
            t = s.tok("dyn")
            s.step("dyntype-preview-0", "preview", t, s.open_preview(t, "sheet"), {"preview": True, **PREVIEW[0]}, "largest Dynamic Type: in-app preview (sheet), portrait")
            t = s.tok("dyntab")
            s.reset()
            s.step("dyntype-tab-0", "tab", t, s.open_tab(t), {"preview": False, "mode": "column", "side": "right"}, "largest Dynamic Type: Safari tab, portrait")
        finally:
            sh("xcrun", "simctl", "ui", s.udid, "content_size", before, check=False)

    def scenario_dark(s):
        before = sh("xcrun", "simctl", "ui", s.udid, "appearance", check=False).stdout.strip() or "light"
        sh("xcrun", "simctl", "ui", s.udid, "appearance", "dark", check=False)
        try:
            t = s.tok("dark")
            s.step("dark-tab-0", "tab", t, s.open_tab(t), {"preview": False, "mode": "column", "side": "right"}, "dark appearance: Safari tab, portrait")
            s.step("dark-tab-0to90", "tab", t, s.rotate(t, 90), {"preview": False, "mode": "column", "side": "left"}, "dark appearance: Safari tab, turn to 90", video=True)
            s.reset()
            t = s.tok("darkpv")
            s.step("dark-preview-0", "preview", t, s.open_preview(t, "sheet"), {"preview": True, **PREVIEW[0]}, "dark appearance: in-app preview (sheet), portrait")
        finally:
            sh("xcrun", "simctl", "ui", s.udid, "appearance", before, check=False)

    # ---- catalogue journeys (catalogue.py, CATALOGUE.md) ------------------------------------------------------------
    def setup_state(s, state):
        """A journey's starting condition, before the page opens: posture and angle (fold.bin), then the music (the
        host in front starts the Live Activity, then Safari comes back in front). False, with s.why, when not reached."""
        _, posture, angle, music = state
        if (posture, angle) != ("closed", 0):
            if not s.fold(posture, angle):
                return False
            s.angle = angle
            time.sleep(1.5)
        if music:
            since = time.time() * 1000
            http("POST", "/la", {"on": True})
            s.host()
            st = s.la_state(True, since)
            sh("xcrun", "simctl", "launch", s.udid, SAFARI, check=False)
            if st is None:
                s.why = f"Live Activity not started in 15s: {http('GET', '/la/state')}"
                return False
            s.la_on = True
            time.sleep(1.0)
        return True

    def journey_action(s, tok, action, state):
        """The driver for one catalogue action, from the state it starts in."""
        surface, posture, angle, _ = state
        preview, k = surface != "tab", action[0]
        if k == "open":
            act = s.open_preview(tok, surface) if preview else s.open_tab(tok)
            s.target_display = s.display()
            return act
        if k == "turn":
            return s.unfold(tok, action[1], preview) if posture == "open" else s.rotate(tok, action[1])
        if k == "unfold":
            return s.unfold(tok, angle, preview)
        if k == "fold":
            return s.fold_closed(tok, angle)
        if k == "music":
            return s.la(tok, action[1], "preview" if preview else "tab")
        if k == "safari":
            return s.open_in_safari(tok)
        raise ValueError(action)

    # ---- interaction suites (catalogue.SUITES, issue #107) --------------------------------------------------------
    def verify(s, res, r, check, sid, tok, kind):
        """A suite step's own outcome (catalogue.py, interaction suites), on the step's final sample. A label Duet
        folded away is looked for in its menu, opened and closed again as a user would."""
        bad = []
        if r is None:
            bad.append("outcome not checked: no sample from the page")
        else:
            labels = [l for l, _ in duet_buttons(r)]
            want = [v for k, v in check.items() if k in ("label", "no_label")]
            if any(v not in labels for v in want) and opener(r):
                folded = s.menu_labels(sid, tok, kind, r)
                if folded is None:
                    bad.append("could not open Duet's menu to look for " + ", ".join(map(repr, want)))
                else:
                    labels += folded
            for k, v in check.items():
                if k == "path" and address(r["path"]) != v:
                    bad.append(f"address is {address(r['path'])}, expected {v}")
                elif k == "label" and v not in labels:
                    bad.append(f'Duet does not show "{v}" (it shows {", ".join(map(repr, labels)) or "nothing"})')
                elif k == "no_label" and v in labels:
                    bad.append(f'Duet still shows "{v}"')
                elif k == "keyboard" and any(n.get("keyboard") for n in r.get("navs") or []) != v:
                    bad.append("Duet did not see the keyboard come up (no data-keyboard)" if v else "Duet still marks the keyboard up (data-keyboard)")
                elif k == "active" and r.get("active") != v:
                    bad.append(f"focus is on {r.get('active') or 'nothing'}, expected {v or 'nothing'}")
                elif k == "dialog" and bool(r.get("dialogs")) != v:
                    bad.append("no page dialog open" if v else "the page dialog is still open")
                elif k == "scroll_gt" and not r["scroll"]["y"] > v:
                    bad.append(f"page scrolled to {r['scroll']['y']}pt, expected more than {v}")
                elif k == "scroll_lt" and not r["scroll"]["y"] < v:
                    bad.append(f"page scrolled to {r['scroll']['y']}pt, expected under {v}")
                elif k == "la" and (http("GET", "/la/state") or {}).get("count", 0) != v:
                    bad.append(f"Live Activities running: {(http('GET', '/la/state') or {}).get('count', 0)}, expected {v}")
        if bad:
            res["reasons"] += bad
            res["status"] = "FAIL" if res["status"] != "BLOCKED" else res["status"]

    @staticmethod
    def find(r, name, back=False):
        """The rect of a control by name in a sample: Duet's buttons first, then the page's targets (aria-label,
        placeholder or text); an exact name, else one that starts with it. back: Duet's back only."""
        cands = duet_buttons(r, back) + ([] if back else [(t["name"], t["rect"]) for t in r.get("targets") or []])
        for ok in (lambda l: l == name, lambda l: l.startswith(name)):
            for l, rc in cands:
                if l and ok(l) and rc["w"] > 0 and rc["h"] > 0:
                    return rc
        return None

    def page_origin(s, r, kind):
        """Page origin in points of the lit display (sim.py taps in those)."""
        return s.origin_open(r, kind, s.native(kind))[:2] if s.position == "open" else s.origin(r, kind)

    def now_sample(s, sid, tok, t0):
        r = s.wait(sid, tok, lambda r: True, t0, timeout=5, page=s.page)
        if r is None:
            s.why = "the page is not reporting"
        return r

    def landed(s, sid, tok, t0, page, check, delay=0.4, new_page=False, cond=None):
        """The first sample after the interaction settled: taken delay s after it, at the expected address if the
        check names one (a link or Back may load a new document), on a new document after a reload. If the address
        never comes, the latest sample, so the step is judged (and fails its check) rather than blocked."""
        done = time.time() * 1000 + delay * 1000
        want = check.get("path")
        ok = lambda r: r["rx"] >= done and (cond is None or cond(r)) and (not new_page or r.get("page") != page)
        r = s.wait(sid, tok, lambda r: ok(r) and (want is None or address(r["path"]) == want), t0, timeout=10,
                   page=None if want or new_page else page)
        if r is None:
            r = s.wait(sid, tok, lambda r: r["rx"] >= done, t0, timeout=5, page=page)
        if r is None:
            s.why = "the page stopped reporting after the step"
        return r

    def menu_labels(s, sid, tok, kind, r):
        """What Duet's folded menu lists: opens it, reads it, closes it (its "Close" item, else a tap on the page)."""
        r2 = s.open_menu(sid, tok, kind, r)
        if r2 is None:
            return None
        items = menu_items(r2)
        close = next((rc for n in shown_navs(r2) for m in n.get("menus") or [] for b in m["buttons"] if b["label"] == "Close" for rc in [b["rect"]]), None)
        x0, y0 = s.page_origin(r2, kind)
        rc = close or s.neutral(r2)
        s.sim.tap(x0 + rc["x"] + rc["w"] / 2, y0 + rc["y"] + rc["h"] / 2, hold=0.12)
        time.sleep(0.8)
        return items

    def open_menu(s, sid, tok, kind, r):
        """Taps the button whose menu holds what Duet folded (opener) and returns a sample with the menu open, or None."""
        op = opener(r)
        if op is None:
            return None
        x0, y0 = s.page_origin(r, kind)
        s.sim.tap(x0 + op["x"] + op["w"] / 2, y0 + op["y"] + op["h"] / 2, hold=0.12)
        time.sleep(0.8)
        r2 = s.now_sample(sid, tok, time.time() * 1000)
        return r2 if r2 and menu_items(r2) else None

    def neutral(s, r):
        """A page point (client px) on no control: the page's own targets, Duet's slots and an open menu avoided."""
        g = r["sig"]
        busy = [t["rect"] for t in r.get("targets") or []] + [sl["rect"] for n in r.get("navs") or [] for sl in (n.get("slots") or []) + (n.get("menus") or [])]
        for fy in (0.12, 0.5, 0.3, 0.7, 0.85):
            for fx in (0.15, 0.5, 0.3):
                x, y = g["innerWidth"] * fx, g["innerHeight"] * fy
                if not any(b["x"] - 8 <= x <= b["x"] + b["w"] + 8 and b["y"] - 8 <= y <= b["y"] + b["h"] + 8 for b in busy):
                    return {"x": x, "y": y, "w": 0, "h": 0}
        return {"x": g["innerWidth"] * 0.15, "y": g["innerHeight"] * 0.12, "w": 0, "h": 0}

    def tap_native(s, kind, ident):
        """Taps a native button by accessibility identifier (never by label: "Book" matches Bookmarks)."""
        el = next((e for e in s.native(kind, s.angle) if e.get("id") == ident), None)
        if el is None:
            s.why = f"no native button {ident}"
            return False
        s.sim.tap(el["x"] + el["w"] / 2, el["y"] + el["h"] / 2, hold=0.12)
        return True

    def to_front(s, kind):
        """Brings the app under test back in front (Safari, or the host whose preview is open)."""
        if kind == "preview":
            s.host()
        else:
            sh("xcrun", "simctl", "launch", s.udid, SAFARI, check=False)

    def suite_action(s, tok, action, state, check):
        """The driver for one suite interaction (a device step goes through journey_action), from the state it starts in."""
        k = action[0]
        if k in catalogue.DEVICE_OPS:
            return s.journey_action(tok, action, state)
        kind = "tab" if state[0] == "tab" else "preview"
        s.target_display = s.display()

        def act(sid, t0):
            if not s.sim:
                s.why = "simulator helper missing (sim.py, Claude desktop app)"
                return None
            page = s.page
            r = s.now_sample(sid, tok, t0)
            if r is None:
                return None
            land = dict(check=check)
            if k == "tap":
                back = action[2:] == ("back",)
                rc = s.find(r, action[1], back)
                if rc is None and opener(r):  # folded into "…" or the lone tab's menu: open it, as a user would
                    r = s.open_menu(sid, tok, kind, r)
                    rc = r and s.find(r, action[1], back)
                if rc is None:
                    s.why = f'no control named "{action[1]}" on the page'
                    return None
                x0, y0 = s.page_origin(r, kind)
                s.sim.tap(x0 + rc["x"] + rc["w"] / 2, y0 + rc["y"] + rc["h"] / 2, hold=0.12)
            elif k == "scroll":  # slow drags of at most 300pt down the page's left part (clear of a column of controls)
                g, (x0, y0) = r["sig"], s.page_origin(r, kind)
                x, n = x0 + g["innerWidth"] * 0.3, -(-abs(action[1]) // 300)
                d = abs(action[1]) / n * (1 if action[1] > 0 else -1)
                y1 = y0 + g["innerHeight"] * (0.75 if d > 0 else 0.25)
                for _ in range(n):
                    s.sim.drag(x, y1, x, y1 - d, ms=500, steps=12, end_hold_ms=200)
                    time.sleep(0.3)
                land["delay"] = 1.5  # let any momentum settle
            elif k == "native":
                if not s.tap_native(kind, action[1]):
                    return None
                land["new_page"] = action[1] == "ReloadButton"
            elif k == "forward":  # Safari's Forward is a swipe in from the web view's right edge (no Forward button)
                g, (x0, y0) = r["sig"], s.page_origin(r, kind)
                y = y0 + g["innerHeight"] / 2
                s.sim.drag(x0 + g["innerWidth"] - 1, y, x0 + g["innerWidth"] * 0.3, y, ms=350, steps=12, end_hold_ms=50)
            elif k == "blur":
                if not any(e.get("label") == "Done" and s.tap_native(kind, e.get("id")) for e in s.native(kind, s.angle) if e.get("id")):
                    rc, (x0, y0) = s.neutral(r), s.page_origin(r, kind)
                    s.sim.tap(x0 + rc["x"], y0 + rc["y"], hold=0.12)
            elif k == "home":
                s.sim.button("HOME")
                time.sleep(2)
                s.to_front(kind)
                land.update(delay=1.5, cond=lambda r: r.get("visible") == "visible")
            elif k == "lock":
                s.sim.button("LOCK")
                time.sleep(2)
                s.sim.button("LOCK")
                time.sleep(1)
                lit = s.sim.lit()
                s.sim.drag(lit["pointWidth"] / 2, lit["pointHeight"] - 3, lit["pointWidth"] / 2, lit["pointHeight"] * 0.3, ms=300, steps=10, end_hold_ms=0)
                land.update(delay=1.5, cond=lambda r: r.get("visible") == "visible")
            elif k == "switcher":
                s.sim.button("HOME")
                time.sleep(0.15)
                s.sim.button("HOME")
                time.sleep(1.5)
                lit = s.sim.lit()
                s.sim.tap(lit["pointWidth"] / 2, lit["pointHeight"] / 2, hold=0.12)
                land.update(delay=1.5, cond=lambda r: r.get("visible") == "visible")
            elif k == "expand":
                isl = s.island(s.angle)
                if not isl:
                    s.why = "no Live Activity in the Dynamic Island"
                    return None
                e = isl[0]
                s.sim.tap(e["x"] + e["w"] / 2, e["y"] + e["h"] / 2, hold=1.0)
                land["delay"] = 1.0
            else:
                raise ValueError(action)
            return s.landed(sid, tok, t0, page, **land)
        return act

    def play_suite(s, suite):
        """One interaction suite: reset, environment (restored after), starting condition, open the page, then each
        step, filmed and judged against the placement of the state it ends in plus its own check. A blocked step ends
        the suite."""
        sid0 = suite["id"]
        steps = catalogue.suite_steps(suite)
        title = suite["title"] + (f' ({", ".join(f"{k} {v}" for k, v in suite["env"].items())})' if suite.get("env") else "")
        rec = {"id": sid0, "title": title, "steps": [], "words": [w for _, _, w, _, _ in steps], "status": "PASS", "film": None, "not_run": 0}
        s.journeys.append(rec)
        s.log(f"\n== {sid0}: {title}")
        s.reset()
        n, env = len(s.results), suite.get("env") or {}
        before = {}
        for k, v in (("appearance", "dark" if env.get("dark") else None), ("content_size", env.get("content_size"))):
            if v:
                before[k] = sh("xcrun", "simctl", "ui", s.udid, k, check=False).stdout.strip() or ("light" if k == "appearance" else "large")
                sh("xcrun", "simctl", "ui", s.udid, k, v, check=False)
        old_path = s.page_path
        s.page_path = suite["page"]
        try:
            start = suite["start"]
            if not s.setup_state(start):
                res = {"id": f"{sid0}-00", "kind": "setup", "desc": f"Set up: {catalogue.state_en(start)}", "status": "BLOCKED",
                       "reasons": ["state not reached: " + s.why], "notes": [], "journey": sid0}
                s.results.append(res)
                rec["steps"].append(res["id"])
                rec["not_run"] = len(steps)
                s.log(f"[{res['id']}] {res['desc']}\n  BLOCKED {res['reasons'][0]}")
            else:
                t, cur = s.tok(sid0), start
                for k, (a, nxt, words, exp_en, check) in enumerate(steps, 1):
                    act = s.journey_action(t, a, cur) if a[0] == "open" else s.suite_action(t, a, cur, check)
                    res = s.step(f"{sid0}-{k:02}", "tab" if nxt[0] == "tab" else "preview", t, act,
                                 lambda sig, st=nxt: catalogue.expect(st, sig), words, video=True,
                                 extra={"journey": sid0, "expect_en": exp_en, "check": check or None}, check=check)
                    rec["steps"].append(res["id"])
                    cur = nxt
                    if res["status"] == "BLOCKED":
                        rec["not_run"] = len(steps) - k
                        break
        finally:
            s.page_path = old_path
            for k, v in before.items():
                sh("xcrun", "simctl", "ui", s.udid, k, v, check=False)
        got = {r["status"] for r in s.results[n:]}
        rec["status"] = "FAIL" if "FAIL" in got else "BLOCKED" if "BLOCKED" in got else "PASS"
        rec["film"] = s.film(sid0, s.results[n:])

    def play(s, i, start, acts):
        """One journey: reset, set up the starting condition, open the page, apply each transition, every step filmed
        and judged against catalogue.expect. A blocked step ends the journey (the next state cannot be reached)."""
        jid = catalogue.jid(i)
        steps = catalogue.steps_en(start, acts)
        rec = {"id": jid, "title": f"{catalogue.SURFACE_EN[start[0]]}, opened {catalogue.state_en(start)}", "steps": [],
               "words": [w for _, _, w, _ in steps], "status": "PASS", "film": None, "not_run": 0}
        s.journeys.append(rec)
        s.log(f"\n== {jid}: {rec['title']}")
        s.reset()
        n = len(s.results)
        if not s.setup_state(start):
            res = {"id": f"{jid}-00", "kind": "setup", "desc": f"Set up: {catalogue.state_en(start)}", "status": "BLOCKED",
                   "reasons": ["state not reached: " + s.why], "notes": [], "journey": jid}
            s.results.append(res)
            rec["steps"].append(res["id"])
            rec["not_run"] = len(steps)
            s.log(f"[{res['id']}] {res['desc']}\n  BLOCKED {res['reasons'][0]}")
        else:
            t, cur = s.tok(jid), start
            for k, (a, nxt, words, exp_en) in enumerate(steps, 1):
                act = s.journey_action(t, a, cur)
                res = s.step(f"{jid}-{k:02}", "tab" if nxt[0] == "tab" else "preview", t, act,
                             lambda sig, st=nxt: catalogue.expect(st, sig), words, video=True,
                             extra={"journey": jid, "expect_en": exp_en})
                rec["steps"].append(res["id"])
                cur = nxt
                if res["status"] == "BLOCKED":
                    rec["not_run"] = len(steps) - k
                    break
        got = {r["status"] for r in s.results[n:]}
        rec["status"] = "FAIL" if "FAIL" in got else "BLOCKED" if "BLOCKED" in got else "PASS"
        rec["film"] = s.film(jid, s.results[n:])

    SCENARIOS = {
        "tab": lambda s: s.scenario_tab(),
        "preview-sheet": lambda s: s.scenario_preview("sheet"),
        "preview-default": lambda s: s.scenario_preview("default"),
        "preview-full": lambda s: s.scenario_preview("full"),
        "open-in-safari": lambda s: s.scenario_open_safari(0),
        "open-in-safari-90": lambda s: s.scenario_open_safari(90),
        "open-in-safari-270": lambda s: s.scenario_open_safari(270),
        "fold": lambda s: s.scenario_fold(),
        "dark": lambda s: s.scenario_dark(),
        "preview-unfolded": lambda s: s.scenario_preview_unfolded(),
        "open-in-safari-unfold": lambda s: s.scenario_open_safari_unfold(),
        "split": lambda s: s.scenario_split(),
        "split-turn": lambda s: s.scenario_split_turn(),
        "split-drag": lambda s: s.scenario_split_drag(),
        "dynamic-type": lambda s: s.scenario_dynamic_type(),
        "live-tab": lambda s: s.scenario_live("tab"),
        "live-preview-sheet": lambda s: s.scenario_live("sheet"),
        "live-preview-default": lambda s: s.scenario_live("default"),
        "live-preview-full": lambda s: s.scenario_live("full"),
    }
    NEEDS_SIM = {"split", "split-turn", "split-drag", "open-in-safari-unfold"}
    EXPERIMENTAL = {"split-drag"}  # run only when named with --only

    def main(s):
        only = set(s.a.only.split(",")) if s.a.only else None
        if not (http("GET", "/runner") or {}).get("alive"):
            s.results.append({"id": "setup", "kind": "setup", "desc": "UI-test runner", "status": "BLOCKED", "reasons": ["UI-test runner not alive"], "notes": []})
        if not os.access(FOLD, os.X_OK):
            s.results.append({"id": "setup", "kind": "setup", "desc": "fold.bin", "status": "BLOCKED", "reasons": [f"{FOLD} missing (fold/build.sh)"], "notes": []})
        if s.a.catalogue:  # the journeys, then the interaction suites, one index across both for sharding
            items = [(catalogue.jid(i), lambda i=i, j=j: s.play(i, *j)) for i, j in enumerate(catalogue.journeys())]
            items += [(su["id"], lambda su=su: s.play_suite(su)) for su in catalogue.SUITES]
            js = [(n, run) for n, (name, run) in enumerate(items) if not only or name in only]
            if s.a.shard:  # i/N: every Nth item, from the ith
                k, m = map(int, s.a.shard.split("/"))
                js = [x for x in js if x[0] % m == k - 1]
            for _, run in js:
                run()
        for name, fn in ({} if s.a.catalogue else s.SCENARIOS).items():
            if (only and name not in only) or (not only and name in s.EXPERIMENTAL):
                continue
            if name in s.NEEDS_SIM and not s.sim:
                s.results.append({"id": name, "kind": "setup", "desc": name, "status": "BLOCKED", "reasons": ["simulator helper missing (sim.py, Claude desktop app)"], "notes": []})
                continue
            s.reset()
            n = len(s.results)
            fn(s)
            s.film(name, s.results[n:])
        s.reset()
        s.report()
        fails = [r for r in s.results if r["status"] == "FAIL"]
        blocked = [r for r in s.results if r["status"] == "BLOCKED"]
        s.log(f"\n{len(s.results)} steps, {len(fails)} failed, {len(blocked)} blocked, report {s.out}/index.html")
        return 1 if fails else 2 if blocked else 0

    def film(s, name, results):
        """Stitches a scenario's step clips into one film, each captioned with its step, result and first reason, at
        30fps on a 720x720 canvas (the closed and unfolded displays differ in size). simctl's clips are variable frame
        rate: the fps filter repeats frames through the gaps, as the screen showed them."""
        clips = [(r, os.path.join(s.out, r["frames"].replace("-frames.png", ".mp4"))) for r in results if r.get("frames")]
        clips = [(r, p) for r, p in clips if os.path.exists(p)]
        if not clips:
            return None
        parts, lst = [], os.path.join(s.out, "shots", f"{name}-film.txt")
        for i, (r, p) in enumerate(clips):
            cap = f'{r["id"]}  {r["status"]}  {r["desc"]}'
            why = (r["reasons"] or [""])[0][:90]
            esc = lambda x: x.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\u2019").replace("%", "\\%")
            col = {"PASS": "0x2a9d3a", "FAIL": "0xd62828"}.get(r["status"], "0xe09f1f")
            out = os.path.join(s.out, "shots", f"{name}-part{i:02}.mp4")
            vf = (f"fps=30,scale=720:600:force_original_aspect_ratio=decrease,pad=720:720:(ow-iw)/2:120:color=black,"
                  f"drawbox=x=0:y=0:w=720:h=12:color={col}:t=fill,"
                  f"drawtext=text='{esc(cap)}':x=12:y=24:fontsize=20:fontcolor=white,"
                  f"drawtext=text='{esc(why)}':x=12:y=60:fontsize=16:fontcolor=0xffb4b4")
            sh("ffmpeg", "-loglevel", "error", "-y", "-i", p, "-vf", vf, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", out, check=False)
            if os.path.exists(out):
                parts.append(out)
        with open(lst, "w") as fh:
            fh.write("".join(f"file '{x}'\n" for x in parts))
        film = os.path.join(s.out, "shots", f"{name}.mp4")
        sh("ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", film, check=False)
        for x in parts + [lst]:
            os.remove(x)
        if not os.path.exists(film):
            return None
        rel = os.path.relpath(film, s.out)
        if not s.a.catalogue:
            s.films.append((name, rel))
        return rel

    # ---- report -----------------------------------------------------------------------------------------------
    def report(s):
        e = html.escape
        rows = []
        for r in s.results:
            f = r.get("final") or {}
            img = r.get("overlay") or r.get("shot")
            fr = r.get("frames")
            timing = f'settle {r.get("settle_ms", "")}ms, hidden {r.get("hidden_ms", 0)}ms, {r.get("samples_n", "")} samples @ {r.get("sample_ms", "")}ms' if f else ""
            rows.append(f'<tr class="{r["status"]}" id="{e(r["id"])}"><td><b>{e(r["id"])}</b><br><small>{e(r["desc"])}</small></td><td>{r["status"]}</td>'
                        f'<td>{e(json.dumps(f)) if f else ""}<br><small>{timing}</small></td>'
                        f'<td><ul>{"".join("<li>" + e(x) + "</li>" for x in r["reasons"])}</ul><small>{"<br>".join(e(x) for x in r["notes"])}</small></td>'
                        f'<td>{f"<a href={e(img)}><img src={e(img)} width=200></a>" if img else ""}'
                        f'{f"<br><a href={e(fr)}><img src={e(fr)} width=320></a>" if fr else ""}</td></tr>')
        by_id = {r["id"]: r for r in s.results}
        page = f" --page {s.a.page}" if s.a.page != "/" else ""
        jhtml = []
        for j in s.journeys:
            items = []
            for sid in j["steps"]:
                r = by_id.get(sid) or {"status": "BLOCKED", "desc": sid, "reasons": ["missing"]}
                why = f' : {e(r["reasons"][0])}' if r["reasons"] else ""
                items.append(f'<li><a href="#{e(sid)}">{e(r["desc"])}</a>. <small>Expect: {e(r.get("expect_en", ""))}.</small> '
                             f'<span class="{r["status"]}"><b>{r["status"]}</b></span>{why}</li>')
            items += [f'<li><small>not run: {e(w)}</small></li>' for w in j["words"][len(j["words"]) - j["not_run"]:]] if j["not_run"] else []
            film = f'<video src="{e(j["film"])}" controls muted playsinline width=480></video>' if j.get("film") else ""
            jhtml.append(f'<section class=j><h2 id="{e(j["id"])}">{e(j["id"])}: {e(j["title"])} <span class="{j["status"]}">{j["status"]}</span></h2>'
                         f'<ol>{"".join(items)}</ol>{film}<p><small>Replay: <code>tools/e2e/run.sh --catalogue --only {e(j["id"])}{e(page)}</code></small></p></section>')
        if s.journeys:
            c = {k: sum(j["status"] == k for j in s.journeys) for k in ("PASS", "FAIL", "BLOCKED")}
            index = "".join(f'<a class="{j["status"]}" href="#{e(j["id"])}">{e(j["id"])}</a> ' for j in s.journeys)
            jhtml.insert(0, f'<p><b>{len(s.journeys)} journeys: {c["PASS"]} pass, {c["FAIL"]} fail, {c["BLOCKED"]} blocked.</b> '
                            f'Scenarios in plain English: CATALOGUE.md.</p><p class=idx>{index}</p>')
        with open(os.path.join(s.out, "results.json"), "w") as fh:
            json.dump({"results": s.results, "films": s.films, "journeys": s.journeys}, fh)
        with open(os.path.join(s.out, "index.html"), "w") as fh:
            fh.write(f"""<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Duo e2e report</title>
<style>body{{font:14px system-ui;margin:16px;background:#fff;color:#111}}table{{border-collapse:collapse;width:100%}}td{{border-top:1px solid #ddd;padding:8px;vertical-align:top}}
.PASS td:nth-child(2),span.PASS,a.PASS{{color:#080}}.FAIL td:nth-child(2),span.FAIL,a.FAIL{{color:#c00;font-weight:bold}}.BLOCKED td:nth-child(2),span.BLOCKED,a.BLOCKED{{color:#a60;font-weight:bold}}small{{color:#666}}
section.j{{border-top:2px solid #ddd;margin-top:24px}}ol li{{margin:4px 0}}.idx a{{display:inline-block;margin:2px 6px 2px 0}}code{{font-size:12px}}
@media (prefers-color-scheme:dark){{body{{background:#111;color:#eee}}td{{border-color:#333}}}}</style>
<h1>Duo e2e report</h1><p>{e(s.out)}. Overlay: red = Duet controls, blue = native buttons, green = preview column gap. Frames: 3.2s from 0.3s before the motion onset, one tile per 100ms.</p>
{"".join(jhtml)}
{"".join(f'<h2>{e(n)}</h2><video src={e(f)} controls muted playsinline width=480></video>' for n, f in s.films)}
<table>{"".join(rows)}</table>""")
        if s.a.md:
            lines = ["| step | result | final (angle, inner, mode/side) | settle | reason | screenshot / frames |", "|---|---|---|---|---|---|"]
            for r in s.results:
                f = r.get("final") or {}
                st = f'{f.get("angle")}, {f.get("inner")}, {"hidden" if not f.get("shown") else str(f.get("mode")) + "/" + str(f.get("side"))}{", preview" if f.get("preview") else ""}' if f else ""
                why = "; ".join(r["reasons"]) or "; ".join(r["notes"]) or "ok"
                img = [os.path.join(s.out, x) for x in (r.get("overlay") or r.get("shot"), r.get("frames")) if x]
                lines.append(f'| {r["id"]} | {r["status"]} | {st} | {r.get("settle_ms", "")} | {why.replace("|", "/")} | {" ".join(img)} |')
            with open(s.a.md, "w") as fh:
                fh.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--udid")
    ap.add_argument("--only", default="")
    ap.add_argument("--md", default="")
    ap.add_argument("--video", action="store_true", help="record a contact sheet for every step, not only transitions")
    ap.add_argument("--page", default="/", help="site path every scenario opens, e.g. /confirm")
    ap.add_argument("--rerender", default="", help="re-assess a saved report dir with the current rules")
    ap.add_argument("--catalogue", action="store_true", help="play the catalogue journeys (CATALOGUE.md), not the scenarios")
    ap.add_argument("--shard", default="", help="i/N: play every Nth journey, from the ith (matrix.sh)")
    ap.add_argument("--beacon", default=BEACON, help="this simulator's beacon origin (matrix.sh: one per simulator)")
    ap.add_argument("--out", default="", help="report dir (default reports/<timestamp>)")
    ap.add_argument("--merge", default="", help="join <dir>/shard-*/results.json into <dir>/index.html")
    a = ap.parse_args()
    BEACON = a.beacon
    if a.merge:
        # Shard reports keep their files; the merged report points into them (shard-i/shots/...).
        r = Run.__new__(Run); r.a, r.out, r.results, r.films, r.journeys = a, os.path.abspath(a.merge), [], [], []
        for d in sorted(x for x in os.listdir(r.out) if x.startswith("shard-") and os.path.isdir(os.path.join(r.out, x))):
            f = os.path.join(r.out, d, "results.json")
            if not os.path.exists(f):
                r.results.append({"id": d, "kind": "setup", "desc": d, "status": "BLOCKED", "reasons": [f"{d} wrote no results.json (see {d}.log)"], "notes": []})
                continue
            got = json.load(open(f))
            for res in got["results"]:
                for k in ("shot", "overlay", "frames"):
                    if res.get(k):
                        res[k] = f"{d}/{res[k]}"
                r.results.append(res)
            for j in got["journeys"]:
                j["film"] = j["film"] and f"{d}/{j['film']}"
                r.journeys.append(j)
            r.films += [(n, f"{d}/{x}") for n, x in got["films"]]
        r.journeys.sort(key=lambda j: j["id"])
        r.a.catalogue = True
        r.report()
        st = {x["status"] for x in r.results}
        print(f"{len(r.journeys)} journeys, {len(r.results)} steps, report {r.out}/index.html")
        sys.exit(1 if "FAIL" in st else 2 if "BLOCKED" in st else 0)
    if not a.udid:
        ap.error("--udid is required")
    if a.rerender:
        r = Run.__new__(Run); r.a, r.out, r.results, r.films, r.journeys = a, os.path.abspath(a.rerender), [], [], []
        for f in sorted(os.listdir(os.path.join(r.out, "steps")), key=lambda f: os.path.getmtime(os.path.join(r.out, "steps", f))):
            res = json.load(open(os.path.join(r.out, "steps", f)))
            if res.get("expect") is not None and res.get("samples"):
                r.position = "open" if max(res["samples"][-1]["sig"]["outerWidth"], res["samples"][-1]["sig"]["outerHeight"]) > 900 else "closed"
                t0 = res["samples"][0]["rx"]
                res.update(status="PASS", reasons=[], notes=[])
                r.assess(res, res["samples"], res.get("native", []), res["expect"], t0, res["kind"], res.get("prev"))
                r.check_icons(res, os.path.join(r.out, res["shot"]) if res.get("shot") else None)
            r.results.append(res)
            print(f'{res["id"]:28} {res["status"]:11} {"; ".join(res.get("reasons", []))[:240]}')
        r.report()
        sys.exit(1 if any(x["status"] == "FAIL" for x in r.results) else 0)
    sys.exit(Run(a).main())
