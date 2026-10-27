#!/usr/bin/env python3
"""Duo e2e matrix: drives the "Duo Lab" simulator through Safari tab, in-app preview and unfolded states, rotations
and folds (tools/e2e/fold/fold.bin), collects the page's Duet state from the beacon every ~40ms, native button
frames from the UI-test runner, a screenshot per step and a video contact sheet per transition, and asserts
tools/e2e/EXPECTED.md on every sample, not only the last. Writes reports/<ts>/{index.html,steps/*.json,shots/*}.

Needs (run.sh starts them): site on :3140 (served from this worktree), beacon on :3141, the UI-test runner.
Usage: e2e.py --udid <sim> [--only <scenario>[,<scenario>]] [--md round.md] [--video]
Exit: 0 all PASS, 1 any FAIL, 2 any BLOCKED (a state the run could not reach, or a broken setup).
"""
import argparse, datetime, html, json, os, signal, subprocess, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = "http://localhost:3140"
BEACON = "http://localhost:3141"
HOST = "dev.duolab.e2e.host"
SAFARI = "com.apple.mobilesafari"
PREVIEW_SVC = "com.apple.SafariViewService"
FOLD = os.path.join(HERE, "fold", "fold.bin")
MIN_S = 2.5     # each step samples at least this long after its action
QUIET_S = 1.5   # and until the signals have not changed for this long
MAX_S = 7.0     # but never longer than this
SETTLE_S = 0.5  # controls must show in the final placement within this of the final signals
GRACE_S = 0.15  # the old placement may linger this long after the signals first change (one render of the chrome)
SLIDE_S = 0.15  # once shown in the final placement, slots must stop moving within this (no slow slide)
GAP_S = 0.15    # sampling gaps longer than this are reported (the page was throttled)
STATE_TIMEOUT = 30

# Rotator orientation per closed-screen angle (fold.bin -deviceOrientation). The page reports landscapeRight as 90.
ORIENT = {0: "portrait", 90: "landscapeRight", 270: "landscapeLeft", 180: "portraitUpsideDown"}
CLOSED = {"position": "closed"}
# Expected per state (EXPECTED.md). Closed Safari tab by angle.
TAB = {0: ("column", "right"), 90: ("column", "left"), 270: ("column", "right")}
# Folding into closed landscape (like opening a tab there) gives Safari's 678x340 window with its bars at the top and
# no column, so the page has no column to draw into: inline on the default side (EXPECTED.md).
LANDSCAPE_TOP_BARS = {"preview": False, "mode": "inline", "side": "right"}
# In-app preview: portrait, in the gap of the preview's own column. Turned, that gap is ~26pt and there is no
# least-intrusive place left (an inline strip narrows the page, user: "the left inline strip is wrong"), so Duet
# hides its controls; the page keeps its full width and the preview's own Done/back/share stay (README).
PREVIEW = {0: {"mode": "column", "side": "right", "gap": True}, 90: {"hidden": True}, 270: {"hidden": True}}
UNFOLDED = {"mode": "inline", "side": "right"}
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


def key(r):
    g = r["sig"]
    return (g["angle"], g["innerWidth"], g["innerHeight"], g["outerWidth"], g["outerHeight"])


def nav(r):
    return (r.get("navs") or [{}])[0]


def shown_place(r):
    """(mode, side) when Duet's controls are visible, None when hidden (data-hidden, or no visible slot)."""
    n = nav(r)
    if n.get("hidden") or not n.get("slots"):
        return None
    return (n.get("mode"), n.get("side"))


class Run:
    def __init__(s, a):
        s.a, s.udid = a, a.udid
        s.out = os.path.join(HERE, "reports", datetime.datetime.now().strftime("%Y%m%d-%H%M%S"))
        for d in ("steps", "shots"):
            os.makedirs(os.path.join(s.out, d), exist_ok=True)
        s.results, s.angle, s.position, s.page, s.last = [], 0, "closed", None, None

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
        """Stops the recording; tiles 2.4s of it starting 0.3s before `at` (ms, wall clock: the first signal change)."""
        proc, p, t_rec = rec
        proc.send_signal(signal.SIGINT)
        try:
            proc.wait(10)
        except subprocess.TimeoutExpired:
            proc.kill()
        if not os.path.exists(p):
            return None
        sheet = p.replace(".mp4", "-frames.png")
        # 2.4s at 10fps from just before the change: one tile per 100ms, left to right, top to bottom.
        ss = max(0.0, ((at or t_rec) - t_rec) / 1000 - 0.3)
        sh("ffmpeg", "-loglevel", "error", "-y", "-ss", f"{ss:.2f}", "-i", p, "-t", "2.4", "-vf", "fps=10,scale=160:-1,tile=8x3:padding=4:color=white", "-frames:v", "1", sheet, check=False)
        return sheet if os.path.exists(sheet) else None

    # ---- one step ---------------------------------------------------------------------------------------------
    def step(s, sid, kind, tok, action, expect, desc, video=False):
        s.log(f"[{sid}] {desc}")
        http("POST", "/step", {"id": sid})
        prev = s.last  # the previous step's final placement and signals
        res = {"id": sid, "kind": kind, "desc": desc, "status": "PASS", "reasons": [], "notes": [], "expect": expect,
               "prev": {"place": prev["place"], "key": prev["key"]} if prev else None}
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
        native = s.native(kind)
        shot = s.screenshot(sid)
        s.assess(res, allr, native, expect, t0, kind, prev)
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
            allr = [r for r in samples(sid, t0) if f"s={tok}" in r["path"] and r.get("page") == s.page]
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

    def native(s, kind):
        if s.position == "open":
            return []  # XCUITest frames on the unfolded inner display are not in screen points we can map (README)
        bundle = PREVIEW_SVC if kind == "preview" else SAFARI
        r = cmd("elements", bundle=bundle)
        return (r or {}).get("elements", [])

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
        else:
            box = (-vx, 0, g["innerWidth"] - vx, g["innerHeight"])
        for x in nav(r).get("slots", []):
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
        # 0. sampling
        gaps = [(b["rx"] - a["rx"]) for a, b in zip(allr, allr[1:])]
        big = [x for x in gaps if x > GAP_S * 1000]
        res["sample_ms"] = round(sorted(gaps)[len(gaps) // 2]) if gaps else None
        if big:
            note.append(f"{len(big)} sampling gaps over {GAP_S * 1000:.0f}ms (max {max(big)}ms)")
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
        for i, r in enumerate(allr):
            p = shown_place(r)
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
        offs = []
        for r in allr:
            p = shown_place(r)
            if p is None or (prev and p == prev["place"] and key(r) != prev["key"] and r["rx"] < t_change + GRACE_S * 1000):
                continue
            o = s.offscreen(r, kind)
            if o:
                offs.append((r["rx"] - t0, o[0]))
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
            if want is not None:
                t_ok = max(t_ok, t_final)
                fin = [r for r in allr if r["rx"] >= t_ok]
                rects = lambda r: {x["slot"]: x["rect"] for x in nav(r).get("slots", [])}
                end = rects(last)
                moving = [r for r in fin if any(abs(r2[c] - end[sl][c]) > 2 for sl, r2 in rects(r).items() if sl in end for c in ("x", "y", "w", "h"))]
                if moving and moving[-1]["rx"] - t_ok > SLIDE_S * 1000:
                    m = moving[0]
                    bad.append(f"slots slide for {moving[-1]['rx'] - t_ok:.0f}ms after showing (e.g. {rects(m)} -> {end})"[:300])
        # 6. native overlap and the preview gap, on the final sample (closed screen only)
        slots = []
        if fp is not None and s.position == "closed":
            x0, y0 = s.origin(last, kind)
            slots = [{"slot": x["slot"], "x": x["rect"]["x"] + x0, "y": x["rect"]["y"] + y0, "w": x["rect"]["w"], "h": x["rect"]["h"]} for x in n.get("slots", [])]
            for sl in slots:
                for e in native:
                    if e["label"] == "Address" and e["w"] > 200:
                        continue
                    ix = min(sl["x"] + sl["w"], e["x"] + e["w"]) - max(sl["x"], e["x"])
                    iy = min(sl["y"] + sl["h"], e["y"] + e["h"]) - max(sl["y"], e["y"])
                    if ix > 2 and iy > 2:
                        bad.append(f'{sl["slot"]} overlaps native "{e["label"]}" by {ix:.0f}x{iy:.0f}')
        elif s.position == "open":
            note.append("unfolded: native frames not mapped, overlap checked by screenshot only")
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
        # 7. overflow / clipping / content under controls, on the final sample
        sx, W0 = last["scroll"]["x"], last["scroll"]["clientWidth"]
        lo, hi = min(0, -sx), max(W0, W0 - sx)
        overs = []
        for o in last.get("overflow", []):
            ov = round(max(o["rect"]["x"] + o["rect"]["w"] - hi, lo - o["rect"]["x"]))
            if ov > 1:
                overs.append({**o, "over": ov})
        for o in [o for o in overs if o["text"]][:4]:
            bad.append(f'clipped text {o["el"][:60]} by {o["over"]}pt')
        for o in [o for o in overs if not o["text"] and not o["el"].startswith(("div.duet-scroller", "main", "section.stage"))][:3]:
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

    def overlay(s, res, shot):
        """Draws Duet's slots (red), native buttons (blue) and the preview gap (green) on the screenshot."""
        try:
            from PIL import Image, ImageDraw
        except ImportError:
            return None
        im = Image.open(shot).convert("RGB")
        a = (res.get("final") or {}).get("angle", 0)
        if res.get("slots") and a in (90, 270) and im.width < im.height:
            im = im.rotate(-90 if a == 90 else 90, expand=True)
        k = im.width / (678 if im.width > im.height else 466)
        d = ImageDraw.Draw(im)
        box = lambda r: [r["x"] * k, r["y"] * k, (r["x"] + r["w"]) * k, (r["y"] + r["h"]) * k]
        for e in res.get("native", []):
            d.rectangle(box(e), outline=(40, 120, 255), width=5)
        if res.get("gap"):
            gp = res["gap"]
            d.rectangle([gp["x"] * k, gp["top"] * k, gp["x2"] * k, gp["bottom"] * k], outline=(0, 200, 80), width=5)
        for sl in res.get("slots", []):
            d.rectangle(box(sl), outline=(255, 40, 40), width=6)
        p = shot.replace(".png", "-overlay.png")
        im.thumbnail((700, 700))
        im.save(p)
        return os.path.relpath(p, s.out)

    # ---- drivers ----------------------------------------------------------------------------------------------
    def url(s, tok):
        return f"{SITE}/?e2e=1&s={tok}"

    def wait(s, sid, tok, cond, t0, timeout=STATE_TIMEOUT, page=None):
        end = time.time() + timeout
        while time.time() < end:
            for r in samples(sid, t0):
                if f"s={tok}" in r["path"] and (page is None or r.get("page") == page) and cond(r):
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
            sh("xcrun", "simctl", "launch", "--terminate-running-process", s.udid, HOST, "-url", s.url(tok), "-style", style)
            return s.wait(sid, tok, lambda r: True, t0)
        return act

    def turn(s, tok, position, angle, cond, label):
        """Folds/turns with fold.bin, then waits for a sample of the same page that satisfies cond."""
        def act(sid, t0):
            page = s.page
            if not s.fold(position, angle):
                return None
            r = s.wait(sid, tok, cond, t0, page=page)
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
            rs = [r for r in samples(sid, t0) if f"s={tok}" in r["path"] and r.get("page") == page]
            return rs[-1] if rs else None
        s.target_display = 1
        return act

    def unfold(s, tok, angle=0):
        # On the inner display "portrait" (0) is the wide 951x669 window, a quarter turn is the tall 669x951 one.
        wide = angle in (0, 180)
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

    def reset(s):
        """Every scenario starts closed, in portrait, with Safari in front and the host preview gone."""
        sh("xcrun", "simctl", "terminate", s.udid, HOST, check=False)
        s.fold("closed", 0)
        s.position, s.angle, s.last = "closed", 0, None
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
        s.step(f"preview-{style}-0", "preview", t, s.open_preview(t, style), {"preview": True, **PREVIEW[0]}, f"in-app preview ({style}), portrait")
        for a in [90, 270, 0]:
            frm = s.angle
            s.step(f"preview-{style}-{frm}to{a}", "preview", t, s.rotate(t, a), {"preview": True, **PREVIEW[a]}, f"in-app preview ({style}), turn {frm} -> {a}", video=True)

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
    }
    # Not automatable on the simulator today (README, Limits). Listed so the matrix stays complete; they do not
    # change the exit status, unlike BLOCKED.
    UNSUPPORTED = {
        "split-left": "split view: tab drag to the screen edge, long press on a tab and the bottom bar swipe were driven with the simulator MCP on the unfolded inner display (XCUITest touches do not reach it) and none opened a split; no API enters it. Covered by unit fixtures (split pane 469x669, inner 385x571)",
        "split-right": "split view: see split-left",
        "split-swap": "split view: see split-left",
        "split-to-full": "split view: see split-left",
    }

    def main(s):
        only = set(s.a.only.split(",")) if s.a.only else None
        if not (http("GET", "/runner") or {}).get("alive"):
            s.results.append({"id": "setup", "kind": "setup", "desc": "UI-test runner", "status": "BLOCKED", "reasons": ["UI-test runner not alive"], "notes": []})
        if not os.access(FOLD, os.X_OK):
            s.results.append({"id": "setup", "kind": "setup", "desc": "fold.bin", "status": "BLOCKED", "reasons": [f"{FOLD} missing (fold/build.sh)"], "notes": []})
        for name, fn in s.SCENARIOS.items():
            if only and name not in only:
                continue
            s.reset()
            fn(s)
        for name, why in s.UNSUPPORTED.items():
            if only and name not in only:
                continue
            s.results.append({"id": name, "kind": "unsupported", "desc": name, "status": "UNSUPPORTED", "reasons": [why], "notes": []})
        s.reset()
        s.report()
        fails = [r for r in s.results if r["status"] == "FAIL"]
        blocked = [r for r in s.results if r["status"] == "BLOCKED"]
        s.log(f"\n{len(s.results)} steps, {len(fails)} failed, {len(blocked)} blocked, report {s.out}/index.html")
        return 1 if fails else 2 if blocked else 0

    # ---- report -----------------------------------------------------------------------------------------------
    def report(s):
        e = html.escape
        rows = []
        for r in s.results:
            f = r.get("final") or {}
            img = r.get("overlay") or r.get("shot")
            fr = r.get("frames")
            timing = f'settle {r.get("settle_ms", "")}ms, hidden {r.get("hidden_ms", 0)}ms, {r.get("samples_n", "")} samples @ {r.get("sample_ms", "")}ms' if f else ""
            rows.append(f'<tr class="{r["status"]}"><td><b>{e(r["id"])}</b><br><small>{e(r["desc"])}</small></td><td>{r["status"]}</td>'
                        f'<td>{e(json.dumps(f)) if f else ""}<br><small>{timing}</small></td>'
                        f'<td><ul>{"".join("<li>" + e(x) + "</li>" for x in r["reasons"])}</ul><small>{"<br>".join(e(x) for x in r["notes"])}</small></td>'
                        f'<td>{f"<a href={e(img)}><img src={e(img)} width=200></a>" if img else ""}'
                        f'{f"<br><a href={e(fr)}><img src={e(fr)} width=320></a>" if fr else ""}</td></tr>')
        with open(os.path.join(s.out, "index.html"), "w") as fh:
            fh.write(f"""<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Duo e2e report</title>
<style>body{{font:14px system-ui;margin:16px;background:#fff;color:#111}}table{{border-collapse:collapse;width:100%}}td{{border-top:1px solid #ddd;padding:8px;vertical-align:top}}
.PASS td:nth-child(2){{color:#080}}.FAIL td:nth-child(2){{color:#c00;font-weight:bold}}.BLOCKED td:nth-child(2){{color:#a60;font-weight:bold}}.UNSUPPORTED td:nth-child(2){{color:#888}}small{{color:#666}}
@media (prefers-color-scheme:dark){{body{{background:#111;color:#eee}}td{{border-color:#333}}}}</style>
<h1>Duo e2e report</h1><p>{e(s.out)}. Overlay: red = Duet controls, blue = native buttons, green = preview column gap. Frames: the transition's first 2.4s, one tile per 100ms.</p>
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
    ap.add_argument("--udid", required=True)
    ap.add_argument("--only", default="")
    ap.add_argument("--md", default="")
    ap.add_argument("--video", action="store_true", help="record a contact sheet for every step, not only transitions")
    ap.add_argument("--rerender", default="", help="re-assess a saved report dir with the current rules")
    a = ap.parse_args()
    if a.rerender:
        r = Run.__new__(Run); r.a, r.out, r.results = a, os.path.abspath(a.rerender), []
        for f in sorted(os.listdir(os.path.join(r.out, "steps")), key=lambda f: os.path.getmtime(os.path.join(r.out, "steps", f))):
            res = json.load(open(os.path.join(r.out, "steps", f)))
            if res.get("expect") is not None and res.get("samples"):
                r.position = "open" if max(res["samples"][-1]["sig"]["outerWidth"], res["samples"][-1]["sig"]["outerHeight"]) > 900 else "closed"
                t0 = res["samples"][0]["rx"]
                res.update(status="PASS", reasons=[], notes=[])
                r.assess(res, res["samples"], res.get("native", []), res["expect"], t0, res["kind"], res.get("prev"))
            r.results.append(res)
            print(f'{res["id"]:28} {res["status"]:11} {"; ".join(res.get("reasons", []))[:240]}')
        r.report()
        sys.exit(1 if any(x["status"] == "FAIL" for x in r.results) else 0)
    sys.exit(Run(a).main())
