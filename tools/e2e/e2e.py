#!/usr/bin/env python3
"""Duo e2e matrix: drives the "Duo Lab" simulator through Safari tab and in-app preview states, collects the page's
Duet state from the beacon, native button frames from the UI-test runner and a screenshot per step, asserts
tools/e2e/EXPECTED.md, writes reports/<ts>/{index.html,steps/*.json,shots/*.png} (and --md <file>).

Needs (run.sh starts them): site on :3140 (served from this worktree), beacon on :3141, the UI-test runner.
Usage: e2e.py --udid <sim> [--only <scenario>[,<scenario>]] [--md round.md] [--rotate-cmd 'cmd {udid} {dir}']
"""
import argparse, datetime, html, json, os, shlex, subprocess, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = "http://localhost:3140"
BEACON = "http://localhost:3141"
HOST = "dev.duolab.e2e.host"
SAFARI = "com.apple.mobilesafari"
PREVIEW_SVC = "com.apple.SafariViewService"
SAMPLE_S = 2.5  # how long each step samples after the state is reached
SETTLE_S = 0.5  # final placement must be reached within this of the state change
QUIET_S = 1.5   # and not change again in the last QUIET_S of the sample window
ROT_TIMEOUT = 120

# Expected per state (EXPECTED.md). angle -> (mode, side) for a closed Safari tab; None = record only.
TAB = {0: ("column", "right"), 90: ("column", "left"), 270: ("column", "right"), 180: None}
# In-app preview (EXPECTED.md, user decision 2026-10-26): portrait, in the gap of the preview's own column. Turned,
# that gap is ~26pt, so inline on the side away from the preview's column (on the side the Duo is turned to).
PREVIEW = {0: {"mode": "column", "side": "right", "gap": True}, 90: {"mode": "inline", "side": "right"}, 270: {"mode": "inline", "side": "left"}}
# Rotation cycle, all counter-clockwise ("left") turns so any rotator (the agent, a human, a future CLI) can follow
# it: 0 -> 90 is one turn, 90 -> 270 is two (through upside down, which Safari and the preview do not adopt, so the
# page jumps landscape to landscape like a real flip), 270 -> 0 is one. Angle 180 is not a UI state on the Duo.
CYCLE = [90, 270, 0]


def http(method, path, body=None, timeout=70):
    req = urllib.request.Request(BEACON + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"null")


def cmd(op, **kw):
    return http("POST", "/cmd?timeout=60000", {"op": op, **kw})


def sh(*a, check=True):
    return subprocess.run(a, capture_output=True, text=True, check=check)


def samples(step, since=0):
    return http("GET", f"/samples?step={step}&since={since}") or []


class Run:
    def __init__(s, a):
        s.a, s.udid = a, a.udid
        s.out = os.path.join(HERE, "reports", datetime.datetime.now().strftime("%Y%m%d-%H%M%S"))
        os.makedirs(os.path.join(s.out, "steps"), exist_ok=True)
        os.makedirs(os.path.join(s.out, "shots"), exist_ok=True)
        s.results, s.angle, s.page = [], None, None

    def log(s, *m):
        print(*m, flush=True)

    # ---- state helpers ---------------------------------------------------------------------------------------
    def wait_samples(s, step, tok, cond, timeout, since):
        """Polls the beacon until a sample from this step's page (path token) satisfies cond. Returns it or None."""
        end = time.time() + timeout
        while time.time() < end:
            for r in samples(step, since):
                if f"s={tok}" in r["path"] and cond(r):
                    return r
            time.sleep(0.2)
        return None

    def rotate_to(s, step, tok, want, since, page=None):
        """No public CLI rotates the Duo's outer display (README). Runs --rotate-cmd if given, then waits for the
        page to report the angle, so an agent or a human can do the turn. Returns the first sample at that angle."""
        cur = s.angle
        direction = {90: "left", 180: "left2", 270: "right"}.get((want - (cur or 0)) % 360, "any")
        msg = f"ROTATE {direction} to angle {want} (now {cur})"
        with open(os.path.join(s.out, "WAITING"), "w") as f:
            f.write(json.dumps({"step": step, "want": want, "now": cur, "direction": direction}))
        s.log("  " + msg)
        if s.a.rotate_cmd:
            subprocess.run(shlex.split(s.a.rotate_cmd.format(udid=s.udid, dir=direction, angle=want)))
        r = s.wait_samples(step, tok, lambda r: r["sig"]["angle"] == want and (page is None or r.get("page") == page), s.a.rot_timeout, since)
        try:
            os.remove(os.path.join(s.out, "WAITING"))
        except OSError:
            pass
        if r:
            s.angle = want
        return r

    def screenshot(s, step):
        p = os.path.join(s.out, "shots", f"{step}.png")
        sh("xcrun", "simctl", "io", s.udid, "screenshot", "--display=1", p, check=False)
        return p if os.path.exists(p) else None

    # ---- one step ---------------------------------------------------------------------------------------------
    def step(s, sid, kind, tok, action, expect, desc):
        s.log(f"[{sid}] {desc}")
        http("POST", "/step", {"id": sid})
        t0 = time.time() * 1000
        res = {"id": sid, "kind": kind, "desc": desc, "status": "PASS", "reasons": [], "notes": [], "expect": expect}
        first = action(sid, t0)
        if first is None:
            res.update(status="BLOCKED", reasons=["state not reached: " + getattr(s, "why", "no sample from the page")])
            s.finish(res, [], [], None)
            return res
        tstate, s.page = first["rx"], first.get("page")
        time.sleep(SAMPLE_S)
        allr = [r for r in samples(sid, tstate) if f"s={tok}" in r["path"] and r.get("page") == s.page]
        native = s.native(kind)
        shot = s.screenshot(sid)
        s.assess(res, allr, native, expect, tstate, kind)
        s.finish(res, allr, native, shot)
        return res

    def native(s, kind):
        bundle = PREVIEW_SVC if kind == "preview" else SAFARI
        r = cmd("elements", bundle=bundle)
        return (r or {}).get("elements", [])

    # ---- assertions -------------------------------------------------------------------------------------------
    @staticmethod
    def placement(r):
        n = (r.get("navs") or [{}])[0]
        return (r.get("preview"), n.get("mode"), n.get("side"), tuple((x["slot"], round(x["rect"]["x"]), round(x["rect"]["y"]), round(x["rect"]["w"]), round(x["rect"]["h"])) for x in n.get("slots", [])))

    @staticmethod
    def origin(r, kind):
        """Page origin in screen points, measured on Duo Lab against the native button frames (README, Geometry):
        the web view starts after the native column when it is on the left (angle 90), a preview sheet is centred
        horizontally under its 70pt chrome, and WebKit offsets the layout viewport by the content inset (vv.x is
        +-84 in a landscape preview), so a fixed element's screen x is pageLeft + rect.x + vv.x."""
        g = r["sig"]
        W = max(g["screenWidth"], g["screenHeight"]) if g["angle"] in (90, 270) else min(g["screenWidth"], g["screenHeight"])
        H = g["screenHeight"] if W == g["screenWidth"] else g["screenWidth"]
        col = g["outerWidth"] - g["innerWidth"] if g["angle"] == 90 else 0
        vx = (r.get("vv") or {}).get("x", 0)
        if kind == "preview":
            return ((W - g["outerWidth"]) / 2 + col + vx, H - g["innerHeight"])
        return (col + vx, 0)

    def assess(s, res, allr, native, expect, tstate, kind):
        bad, note = res["reasons"], res["notes"]
        if not allr:
            res["status"] = "BLOCKED"; bad.append("no samples after the state was reached"); return
        last = allr[-1]
        g, n = last["sig"], (last.get("navs") or [{}])[0]
        res["final"] = {"angle": g["angle"], "inner": f'{g["innerWidth"]}x{g["innerHeight"]}', "outer": f'{g["outerWidth"]}x{g["outerHeight"]}',
                        "inset": g["insetBottom"], "preview": last.get("preview"), "reason": last.get("reason"), "mode": n.get("mode"), "side": n.get("side")}
        # 1. mode / side / preview
        if "preview" in expect and last.get("preview") != expect["preview"]:
            bad.append(f'preview detected={last.get("preview")}, expected {expect["preview"]}')
        if expect.get("mode") and n.get("mode") != expect["mode"]:
            bad.append(f'mode {n.get("mode")}/{n.get("side")}, expected {expect["mode"]}' + (f'/{expect["side"]}' if expect.get("side") else ""))
        elif expect.get("side") and n.get("side") != expect["side"]:
            bad.append(f'side {n.get("side")}, expected {expect["side"]}')
        if expect.get("record"):
            note.append(f'recorded: {n.get("mode")}/{n.get("side")}')
        # 2. controls on screen, not over native buttons, in the preview gap
        x0, y0 = s.origin(last, kind)
        W, H = g["screenWidth"], g["screenHeight"]
        if g["angle"] in (90, 270) and W < H:
            W, H = H, W
        slots = [{"slot": x["slot"], "x": x["rect"]["x"] + x0, "y": x["rect"]["y"] + y0, "w": x["rect"]["w"], "h": x["rect"]["h"]} for x in n.get("slots", [])]
        res["slots"] = slots
        if not slots:
            bad.append("no Duet controls visible")
        for sl in slots:
            if sl["x"] < -1 or sl["y"] < -1 or sl["x"] + sl["w"] > W + 1 or sl["y"] + sl["h"] > H + 1:
                bad.append(f'{sl["slot"]} off screen at {sl["x"]:.0f},{sl["y"]:.0f} ({W}x{H})')
            for e in native:
                if e["label"] == "Address" and e["w"] > 200:
                    continue  # the address field spans the top; overlap with it would already be "under chrome"
                ix = min(sl["x"] + sl["w"], e["x"] + e["w"]) - max(sl["x"], e["x"])
                iy = min(sl["y"] + sl["h"], e["y"] + e["h"]) - max(sl["y"], e["y"])
                if ix > 2 and iy > 2:
                    bad.append(f'{sl["slot"]} overlaps native "{e["label"]}" by {ix:.0f}x{iy:.0f}')
        if expect.get("gap") and slots:
            col = [e for e in native if e["w"] <= 60]
            if col:
                cx, cx2 = min(e["x"] for e in col) - 8, max(e["x"] + e["w"] for e in col) + 8
                above = [e for e in col if e["label"] in ("Page Menu", "Cancel", "Done", "Close")]
                below = [e for e in col if e["label"] == "Back"]
                if above and below:
                    top, bot = max(e["y"] + e["h"] for e in above), min(e["y"] for e in below)
                    res["gap"] = {"x": cx, "x2": cx2, "top": top, "bottom": bot, "h": bot - top}
                    if bot - top < 49:
                        note.append(f"no usable gap in the preview column ({bot - top:.0f}pt between reader and back): fallback placement, only overlap and clipping asserted")
                        slots_in_gap = []
                    else:
                        slots_in_gap = slots
                    for sl in slots_in_gap:
                        if not (sl["x"] >= cx and sl["x"] + sl["w"] <= cx2 and sl["y"] >= top - 1 and sl["y"] + sl["h"] <= bot + 1):
                            bad.append(f'{sl["slot"]} not in the preview column gap (x {cx:.0f}..{cx2:.0f}, y {top:.0f}..{bot:.0f}), at {sl["x"]:.0f},{sl["y"]:.0f}')
                else:
                    note.append("preview column buttons not found, gap not measured")
        # 3. overflow / clipping
        # Visible band in getBoundingClientRect coordinates: [0, W], widened by the horizontal scroll offset. In a
        # landscape preview WebKit reports scrollX = +-84 (the native column's content inset) with nothing to scroll,
        # and static content sits at x-84 while fully visible, so the band follows the offset (README, Geometry).
        sx, W0 = last["scroll"]["x"], last["scroll"]["clientWidth"]
        lo, hi = min(0, -sx), max(W0, W0 - sx)
        overs = []
        for o in last.get("overflow", []):
            ov = round(max(o["rect"]["x"] + o["rect"]["w"] - hi, lo - o["rect"]["x"]))
            if ov > 1:
                overs.append({**o, "over": ov})
        text_over = [o for o in overs if o["text"]]
        block_over = [o for o in overs if not o["text"] and not o["el"].startswith(("div.duet-scroller", "main", "section.stage"))]
        bleed = last["scroll"]["scrollWidth"] - last["scroll"]["clientWidth"]
        for o in text_over[:4]:
            bad.append(f'clipped text {o["el"][:60]} by {o["over"]}pt')
        for o in block_over[:3]:
            bad.append(f'overflowing block {o["el"][:60]} by {o["over"]}pt')
        if bleed > 0:
            note.append(f"scrollWidth {last['scroll']['scrollWidth']} > {last['scroll']['clientWidth']} (column bleed, documented)")
        for u in last.get("underControls", [])[:3]:
            bad.append(f'content under Duet control: {u["el"][:60]}')
        # 4. settle and drift
        changes, prev = [], None
        for r in allr:
            p = s.placement(r)
            if p != prev:
                changes.append(r["rx"]); prev = p
        lastchange = changes[-1] - tstate if changes else 0
        res["settle_ms"] = round(lastchange)
        res["changes"] = len(changes) - 1
        if lastchange > SETTLE_S * 1000:
            if allr[-1]["rx"] - changes[-1] < QUIET_S * 1000:
                bad.append(f"still moving {lastchange/1000:.1f}s after the state change (drift)")
            else:
                bad.append(f"settled {lastchange/1000:.1f}s after the state change (> {SETTLE_S}s)")
        if bad:
            res["status"] = "FAIL"

    def finish(s, res, allr, native, shot):
        res["native"] = native
        res["shot"] = os.path.relpath(shot, s.out) if shot else None
        if shot and res.get("slots") is not None:
            res["overlay"] = s.overlay(res, shot)
        with open(os.path.join(s.out, "steps", res["id"] + ".json"), "w") as f:
            json.dump({**res, "samples": allr}, f)
        s.results.append(res)
        s.log(f"  {res['status']} " + "; ".join(res["reasons"]))

    def overlay(s, res, shot):
        """Draws Duet's slots (red), native buttons (blue) and the preview gap (green) on the screenshot, upright."""
        try:
            from PIL import Image, ImageDraw
        except ImportError:
            return None
        im = Image.open(shot).convert("RGB")
        a = (res.get("final") or {}).get("angle", 0)
        # simctl normally captures the screen upright; if it came back in the panel's portrait frame, turn it.
        if a in (90, 270) and im.width < im.height:
            im = im.rotate(-90 if a == 90 else 90, expand=True)
        k = im.width / (678 if a in (90, 270) else 466)
        d = ImageDraw.Draw(im)
        box = lambda r: [r["x"] * k, r["y"] * k, (r["x"] + r["w"]) * k, (r["y"] + r["h"]) * k]
        for e in res.get("native", []):
            d.rectangle(box(e), outline=(40, 120, 255), width=5)
        if res.get("gap"):
            gp = res["gap"]
            d.rectangle([gp["x"] * k, gp["top"] * k, gp.get("x2", gp["x"] + 64) * k, gp["bottom"] * k], outline=(0, 200, 80), width=5)
        for sl in res.get("slots", []):
            d.rectangle(box(sl), outline=(255, 40, 40), width=6)
        p = shot.replace(".png", "-overlay.png")
        im.thumbnail((700, 700))
        im.save(p)
        return os.path.relpath(p, s.out)

    # ---- drivers ----------------------------------------------------------------------------------------------
    def url(s, tok):
        return f"{SITE}/?e2e=1&s={tok}"

    def open_tab(s, tok):
        def act(sid, t0):
            sh("xcrun", "simctl", "openurl", s.udid, s.url(tok))
            r = s.wait_samples(sid, tok, lambda r: not r.get("preview"), 30, t0)
            if r:
                s.angle = r["sig"]["angle"]
            return r
        return act

    def open_preview(s, tok, style):
        def act(sid, t0):
            sh("xcrun", "simctl", "launch", "--terminate-running-process", s.udid, HOST, "-url", s.url(tok), "-style", style)
            r = s.wait_samples(sid, tok, lambda r: True, 30, t0)
            if r:
                s.angle = r["sig"]["angle"]
            return r
        return act

    def rotate(s, tok, want):
        def act(sid, t0):
            page = s.page
            r = s.rotate_to(sid, tok, want, t0, page)
            s.why = f"angle {want} not reached in {s.a.rot_timeout}s (no rotator: README, Rotation)"
            return r
        return act

    def open_in_safari(s, tok):
        def act(sid, t0):
            r = cmd("tap", bundle=PREVIEW_SVC, label="Open in Safari")
            if not r or not r.get("ok"):
                s.why = f"tap Open in Safari failed: {r}"
                return None
            gone = s.page  # the preview's document keeps reporting while it is dismissed: follow the new tab's
            return s.wait_samples(sid, tok, lambda r: r.get("page") != gone and not r.get("preview"), 30, t0)
        return act

    def need_portrait(s):
        """Each scenario starts in portrait; a rotation scenario that was cut short leaves the sim turned."""
        if s.angle not in (None, 0):
            http("POST", "/step", {"id": "reset"})
            s.rotate_to("reset", "", 0, 0)

    # ---- scenarios --------------------------------------------------------------------------------------------
    def scenario_tab(s):
        tok = "tab" + str(int(time.time()))
        s.step("tab-0", "tab", tok, s.open_tab(tok), {"preview": False, "mode": "column", "side": "right"}, "Safari tab, closed, portrait")
        for a in CYCLE:
            exp = TAB[a]
            e = {"preview": False, **({"mode": exp[0], "side": exp[1]} if exp else {"record": True})}
            s.step(f"tab-{s.angle}to{a}", "tab", tok, s.rotate(tok, a), e, f"Safari tab, rotate to angle {a}")

    def scenario_preview(s, style, rotations=True):
        tok = f"pv{style}{int(time.time())}"
        s.step(f"preview-{style}-0", "preview", tok, s.open_preview(tok, style), {"preview": True, **PREVIEW[0]}, f"in-app preview ({style}), portrait")
        if rotations:
            for a in CYCLE:
                s.step(f"preview-{style}-{s.angle}to{a}", "preview", tok, s.rotate(tok, a), {"preview": True, **PREVIEW[a]}, f"in-app preview ({style}), rotate to angle {a}")

    def scenario_open_safari(s):
        tok = "pvos" + str(int(time.time()))
        s.step("openinsafari-preview", "preview", tok, s.open_preview(tok, "sheet"), {"preview": True, **PREVIEW[0]}, "in-app preview (sheet) before Open in Safari")
        s.step("openinsafari-tab", "tab", tok, s.open_in_safari(tok), {"preview": False, "mode": "column", "side": "right"}, "preview -> Open in Safari -> Safari tab, portrait")

    SCENARIOS = {
        "tab": lambda s: s.scenario_tab(),
        "preview-sheet": lambda s: s.scenario_preview("sheet"),
        "preview-default": lambda s: s.scenario_preview("default", rotations=False),
        "preview-full": lambda s: s.scenario_preview("full", rotations=False),
        "open-in-safari": lambda s: s.scenario_open_safari(),
    }
    # Documented, not automatable on the simulator (README): recorded as BLOCKED so the matrix stays complete.
    BLOCKED = {
        "angle-180": "upside down: Safari and SFSafariViewController keep the previous orientation on the Duo (verified: two left turns from 90 leave the page at angle 90), so 180 is not a reachable UI state",
        "unfolded-full": "fold/unfold: the hinge is only reachable through a private dtuhidd XPC endpoint, no public simctl/devicectl/XCTest API",
        "split-left": "split view: no API enters or moves Safari between split panes on the simulator",
        "split-right": "split view: no API enters or moves Safari between split panes on the simulator",
        "split-swap": "split view: no API enters or moves Safari between split panes on the simulator",
        "split-to-full": "split view: no API enters or moves Safari between split panes on the simulator",
        "fold-transitions": "fold/unfold: see unfolded-full",
    }

    def main(s):
        only = set(s.a.only.split(",")) if s.a.only else None
        if not (http("GET", "/runner") or {}).get("alive"):
            s.log("UI-test runner not alive (native frames and Open in Safari need it)")
        for name, fn in s.SCENARIOS.items():
            if only and name not in only:
                continue
            s.need_portrait()
            fn(s)
        for name, why in s.BLOCKED.items():
            if only and name not in only:
                continue
            s.results.append({"id": name, "kind": "blocked", "desc": name, "status": "BLOCKED", "reasons": [why], "notes": []})
        s.need_portrait()
        s.report()
        fails = [r for r in s.results if r["status"] == "FAIL"]
        s.log(f"\n{len(s.results)} steps, {len(fails)} failed, report {s.out}/index.html")
        return 1 if fails else 0

    # ---- report -----------------------------------------------------------------------------------------------
    def report(s):
        e = html.escape
        rows = []
        for r in s.results:
            f = r.get("final") or {}
            img = r.get("overlay") or r.get("shot")
            rows.append(f'<tr class="{r["status"]}"><td><b>{e(r["id"])}</b><br><small>{e(r["desc"])}</small></td><td>{r["status"]}</td>'
                        f'<td>{e(json.dumps(f)) if f else ""}<br>settle {r.get("settle_ms", "")}ms, {r.get("changes", "")} changes</td>'
                        f'<td><ul>{"".join("<li>" + e(x) + "</li>" for x in r["reasons"])}</ul><small>{"<br>".join(e(x) for x in r["notes"])}</small></td>'
                        f'<td>{f"<a href={e(img)}><img src={e(img)} width=220></a>" if img else ""}</td></tr>')
        with open(os.path.join(s.out, "index.html"), "w") as fh:
            fh.write(f"""<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Duo e2e report</title>
<style>body{{font:14px system-ui;margin:16px;background:#fff;color:#111}}table{{border-collapse:collapse;width:100%}}td{{border-top:1px solid #ddd;padding:8px;vertical-align:top}}
.PASS td:nth-child(2){{color:#080}}.FAIL td:nth-child(2){{color:#c00;font-weight:bold}}.BLOCKED td:nth-child(2){{color:#a60}}small{{color:#666}}
@media (prefers-color-scheme:dark){{body{{background:#111;color:#eee}}td{{border-color:#333}}}}</style>
<h1>Duo e2e report</h1><p>{e(s.out)}. Overlay: red = Duet controls, blue = native buttons, green = preview column gap.</p>
<table>{"".join(rows)}</table>""")
        if s.a.md:
            lines = ["| step | result | state (angle, inner, mode/side) | reason | screenshot |", "|---|---|---|---|---|"]
            for r in s.results:
                f = r.get("final") or {}
                st = f'{f.get("angle")}, {f.get("inner")}, {f.get("mode")}/{f.get("side")}{", preview" if f.get("preview") else ""}' if f else ""
                why = "; ".join(r["reasons"]) or "; ".join(r["notes"]) or "ok"
                img = r.get("overlay") or r.get("shot")
                lines.append(f'| {r["id"]} | {r["status"]} | {st} | {why.replace("|", "/")} | {os.path.join(s.out, img) if img else ""} |')
            with open(s.a.md, "w") as fh:
                fh.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--udid", required=True)
    ap.add_argument("--only", default="")
    ap.add_argument("--md", default="")
    ap.add_argument("--rotate-cmd", default="", help="command run for each quarter turn: {udid} {dir} {angle}")
    ap.add_argument("--rot-timeout", type=int, default=ROT_TIMEOUT)
    ap.add_argument("--rerender", default="", help="rebuild overlays, index.html and --md from an existing report dir")
    a = ap.parse_args()
    if a.rerender:
        r = Run.__new__(Run); r.a, r.out = a, os.path.abspath(a.rerender)
        r.results = []
        for f in sorted(os.listdir(os.path.join(r.out, "steps")), key=lambda f: os.path.getmtime(os.path.join(r.out, "steps", f))):
            res = json.load(open(os.path.join(r.out, "steps", f)))
            if res.get("expect") is not None and res.get("samples"):  # re-assess with the current rules
                res.update(status="PASS", reasons=[], notes=[])
                r.assess(res, res["samples"], res.get("native", []), res["expect"], res["samples"][0]["rx"], res["kind"])
            if res.get("shot") and res.get("slots") is not None:
                res["overlay"] = r.overlay(res, os.path.join(r.out, res["shot"]))
            r.results.append(res)
        r.results += [{"id": n, "kind": "blocked", "desc": n, "status": "BLOCKED", "reasons": [w], "notes": []} for n, w in Run.BLOCKED.items()]
        r.report(); sys.exit(0)
    sys.exit(Run(a).main())
