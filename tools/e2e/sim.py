"""Touch, hinge and accessibility on the Duo simulator through the Claude desktop app's simulator helper
(claude-ios-sim, built on facebook/idb). It is the only driver found that reaches the unfolded inner display: XCUITest
synthesized touches and SimulatorKit's legacy Indigo HID (targets 0x32..0x35) do not, while the helper negotiates
CoreSimulator's dtuhid transport, which routes a touch to the lit display (README, Split view).

Protocol (from the app's own client): each request is a frame of a little-endian u32 payload length, one type byte
(74, 'J' = JSON) and the JSON {"id", "op", ...}; replies are frames of the same shape, {"id", "ok", "result"|"error"}.
Large replies (a PNG, a UI tree) use type 66: the u32 request id, then the raw payload. Coordinates are points of the lit display in its current orientation.
"""
import json, os, select, struct, subprocess, time

HELPER = os.environ.get("DUO_SIM_HELPER", "/Applications/Claude.app/Contents/Helpers/Claude iOS Sim.app/Contents/MacOS/claude-ios-sim")
JSON, BIN = 74, 66


class SimError(RuntimeError):
    pass


class Sim:
    def __init__(s, udid):
        s.udid, s.p, s.n = udid, None, 0

    @staticmethod
    def available():
        return os.access(HELPER, os.X_OK)

    def _spawn(s):
        if s.p and s.p.poll() is None:
            return
        s.p = subprocess.Popen([HELPER], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

    def call(s, op, timeout=30, **kw):
        s._spawn()
        s.n += 1
        body = json.dumps({"id": s.n, "op": op, "udid": s.udid, **kw}).encode()
        s.p.stdin.write(struct.pack("<IB", len(body), JSON) + body)
        s.p.stdin.flush()
        end = time.time() + timeout
        while time.time() < end:
            if not select.select([s.p.stdout], [], [], 0.2)[0]:
                if s.p.poll() is not None:
                    raise SimError(f"helper exited ({s.p.returncode}) during {op}")
                continue
            n, t = struct.unpack("<IB", s.p.stdout.read(5))
            data = s.p.stdout.read(n)
            if t == BIN:  # u32 request id, then the payload (a PNG, or a large JSON result such as a UI tree)
                if struct.unpack("<I", data[:4])[0] == s.n:
                    body = data[4:]
                    return json.loads(body) if body[:1] in (b"{", b"[") else body
                continue
            if t != JSON:
                continue
            r = json.loads(data)
            if r.get("id") != s.n:
                continue
            if not r.get("ok"):
                raise SimError(f"{op}: {r.get('error')}")
            return r.get("result")
        raise SimError(f"{op}: no reply in {timeout}s")

    def close(s):
        if s.p and s.p.poll() is None:
            s.p.kill()
        s.p = None

    # ---- gestures (points of the lit display) ----
    def tap(s, x, y, hold=0.0):
        s.call("tap", x=x, y=y, **({"durationSec": hold} if hold else {}))

    def path(s, points):
        """points: [(x, y, dt_ms)] where dt_ms is the delay before that sample; first is touch down, last is lift."""
        s.call("touchPath", timeout=30 + sum(p[2] for p in points) / 1000, points=[{"x": x, "y": y, "dtMs": dt} for x, y, dt in points])

    def drag(s, x1, y1, x2, y2, hold_ms=0, ms=600, steps=20, end_hold_ms=150):
        """Touch down, optionally hold (long press to pick something up), move in steps, hold, lift."""
        pts = [(x1, y1, 0)]
        if hold_ms:
            pts.append((x1, y1, hold_ms))
        pts += [(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps, ms / steps) for i in range(1, steps + 1)]
        pts.append((x2, y2, end_hold_ms))
        s.path(pts)

    def button(s, name):
        s.call("button", name=name)

    def lit(s):
        """{pointWidth, pointHeight, quarterTurns, state} of the lit display."""
        return s.call("litDisplay")

    def ui(s):
        """Accessibility tree of the lit display (frames in its points)."""
        return s.call("uiDescribeAll", timeout=60, keys=["AXLabel", "AXUniqueId", "type", "frame", "pid", "hidden"])

    def text(s, value):
        s.call("text", value=value)

    def app_ui(s, pid):
        """Flat [{label, id, x, y, w, h}] of one app's accessibility elements, in points of its window (the pane in
        split view, the lit display when full screen). Works for an app that is not frontmost, e.g. either split pane."""
        r = s.call("uiDescribeApplication", timeout=60, pid=pid, keys=["AXLabel", "AXUniqueId", "type", "frame"])
        out = []

        def walk(e, depth):
            f = e.get("frame") or {}
            if depth and (e.get("label") or e.get("identifier")) and f:
                out.append({"label": e.get("label") or "", "id": e.get("identifier") or "", "type": e.get("type"),
                            "x": f["x"], "y": f["y"], "w": f["width"], "h": f["height"]})
            for c in e.get("children") or []:
                walk(c, depth + 1)
        for e in (r or {}).get("elements", []):
            walk(e, 0)
        return out

    def pid(s, label):
        """pid of a launchd job in the simulator by its label suffix (com.apple.SpringBoard, or
        UIKitApplication:<bundle>[...] for an app), or None."""
        out = subprocess.run(["xcrun", "simctl", "spawn", s.udid, "launchctl", "list"], capture_output=True, text=True).stdout
        for line in out.splitlines():
            f = line.split("\t")
            if len(f) == 3 and f[0].isdigit() and (f[2] == label or f[2].startswith(f"UIKitApplication:{label}[")):
                return int(f[0])
        return None

    def springboard_find(s, identifier):
        """Centre (lit display points) of a SpringBoard element (home icon, context menu item) by accessibility
        identifier, or None. Described through SpringBoard's own pid: uiDescribeAll covers only the frontmost app,
        which in split view is the other pane's app, not the home screen beside it. SpringBoard reports frames in the
        unrotated display space; at display rotation 90 (the wide unfolded posture) a point maps to (width - y, x)."""
        pid = s.pid("com.apple.SpringBoard")
        if not pid:
            return None
        r = s.call("uiDescribeApplication", timeout=60, pid=pid, keys=["AXLabel", "AXUniqueId", "type", "frame"])
        scr = (r or {}).get("screen", {})
        rot, W = (scr.get("display") or {}).get("rotation", 0), scr.get("width", 0)

        def walk(e):
            if e.get("identifier") == identifier and e.get("frame"):
                return e["frame"]
            for c in e.get("children") or []:
                f = walk(c)
                if f:
                    return f
        for e in (r or {}).get("elements", []):
            f = walk(e)
            if f:
                cx, cy = f["x"] + f["width"] / 2, f["y"] + f["height"] / 2
                return (W - cy, cx) if rot == 90 else (cx, cy)
        return None
