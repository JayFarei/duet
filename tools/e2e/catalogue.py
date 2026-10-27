#!/usr/bin/env python3
"""The scenario catalogue: every state the Duo can show a page in, every transition between them, and the journeys
that walk all of them. Pure data, no device: e2e.py plays the journeys (run.sh --catalogue), and
`python3 catalogue.py > CATALOGUE.md` writes the plain-English list.

A state is (surface, posture, angle, music):
  surface  tab (a Safari tab) or an in-app preview (SFSafariViewController) styled sheet, default or full
  posture  closed (the outer screen) or open (the inner screen)
  angle    0, 90 or 270 (closed: upright, landscape right, landscape left; open: wide, tall right, tall left)
  music    a Live Activity running in the Dynamic Island, or not
A journey sets the device up first (posture, angle, music), then opens the page, so "open on the inner screen" and
"open on the outer screen, then unfold" are different journeys. Then it applies transitions: turn, fold or unfold,
start or stop the music, and Open in Safari (a preview becomes a tab). Journeys are generated to cover every start
state and every transition at least once, at most MAX_STEPS steps each, in a fixed order so their ids are stable.

Expected placement per state is EXPECTED.md, as data here so the driver and the catalogue read the same rules.
"""
import sys

SURFACES = ("tab", "sheet", "default", "full")
POSTURES = ("closed", "open")
ANGLES = (0, 90, 270)
MAX_STEPS = 8  # the open plus up to 7 transitions: a journey stays short enough to watch

# ---- expected placement (EXPECTED.md) ------------------------------------------------------------------------------
# Closed Safari tab by angle.
TAB = {0: ("column", "right"), 90: ("column", "left"), 270: ("column", "right")}
# Folding into closed landscape (like opening a tab there) gives Safari's 678x340 window with its bars at the top and
# no column, so the page has no column to draw into: inline on the default side (EXPECTED.md).
LANDSCAPE_TOP_BARS = {"preview": False, "mode": "inline", "side": "right"}
# In-app preview: portrait, in the gap of the preview's own column. Turned, the sheet's column gap is ~26pt and there
# is no least-intrusive place left (an inline strip narrows the page, user: "the left inline strip is wrong"), so Duet
# hides its controls; the page keeps its full width and the preview's own Done/back/share stay (README). The default
# and full styles turned put every native button in a top bar and leave the 84pt safe-area inset on the turned side
# free below it: the controls go there, as a strip (round 4).
PREVIEW = {0: {"mode": "column", "side": "right", "gap": True}, 90: {"hidden": True}, 270: {"hidden": True}}
PREVIEW_FULL = {**PREVIEW, 90: {"mode": "strip", "side": "left"}, 270: {"mode": "strip", "side": "right"}}
def preview_expect(style, angle):
    return {"preview": True, **(PREVIEW if style == "sheet" else PREVIEW_FULL)[angle]}
UNFOLDED = {"mode": "inline", "side": "right"}
UNFOLDED_PREVIEW = {"preview": True, **UNFOLDED}
# Split view (wide inner display only, two 469x669 panes): the page cannot tell which pane it is in, so the column
# is drawn on both edges and the native column of whichever pane hides the far copy (EXPECTED.md).
SPLIT = {"mode": "column", "side": "both"}


def top_bars(sig):
    """Safari's closed landscape window with its bars at the top and no column: the page spans the full 678pt width
    (inner 678x340 or 678x386 under the bars), where the column window leaves it 594 (the outer size, the screen's
    678x466, is the same in both)."""
    return sig["outerWidth"] > sig["outerHeight"] and sig["outerWidth"] > 600 and sig["innerWidth"] == sig["outerWidth"]


def expect(state, sig=None):
    """Expected placement in a state. A closed landscape tab has two windows, the column one (turned from portrait)
    and the top bars one (opened or folded into landscape); which one Safari chose is read from the final sample."""
    surface, posture, angle, _ = state
    if posture == "open":
        return dict(UNFOLDED_PREVIEW) if surface != "tab" else {"preview": False, **UNFOLDED}
    if surface != "tab":
        return preview_expect(surface, angle)
    if angle and sig and top_bars(sig):
        return dict(LANDSCAPE_TOP_BARS)
    return {"preview": False, "mode": TAB[angle][0], "side": TAB[angle][1]}


# ---- the graph -----------------------------------------------------------------------------------------------------
STATES = [(su, po, an, mu) for su in SURFACES for po in POSTURES for an in ANGLES for mu in (False, True)]


def transitions(state):
    """(action, next state) from a state, in a fixed order. Open in Safari is closed only: on the inner display the
    runner's taps do not land (README, Split view), see GAPS."""
    su, po, an, mu = state
    out = [(("turn", b), (su, po, b, mu)) for b in ANGLES if b != an]
    out.append((("unfold",) if po == "closed" else ("fold",), (su, "open" if po == "closed" else "closed", an, mu)))
    out.append((("music", not mu), (su, po, an, not mu)))
    if su != "tab" and po == "closed":
        out.append((("safari",), ("tab", po, an, mu)))
    return out


GAPS = [
    "Open in Safari from a preview on the inner screen: the UI-test runner's taps do not reach the inner display.",
    "Split view: covered by the split, split-turn and open-in-safari-unfold scenarios, not by journeys yet.",
    "Upside down (180): Safari and the preview do not adopt it on the Duo, covered by the tab scenario.",
]


def journeys():
    """Greedy edge cover: one journey per start state (every surface opened in every device state), each walking
    uncovered transitions, preferring the one whose next state has the most uncovered transitions left; then extra
    journeys from the source of any transition still uncovered. Returns [(start state, [action, ...])]."""
    todo = {(st, a) for st in STATES for a, _ in transitions(st)}
    out = []

    def walk(start):
        cur, acts = start, []
        while len(acts) < MAX_STEPS - 1:
            cand = [(a, n) for a, n in transitions(cur) if (cur, a) in todo]
            if not cand:
                break
            a, n = max(cand, key=lambda c: sum((c[1], x) in todo for x, _ in transitions(c[1])))
            todo.discard((cur, a))
            acts.append(a)
            cur = n
        out.append((start, acts))

    for st in STATES:
        walk(st)
    while todo:
        walk(min(todo, key=lambda e: STATES.index(e[0]))[0])
    return out


def jid(i):
    return f"j{i + 1:02}"


# ---- plain English -------------------------------------------------------------------------------------------------
SURFACE_EN = {"tab": "a Safari tab", "sheet": "the in-app preview, sheet style", "default": "the in-app preview, default style",
              "full": "the in-app preview, full screen style", "over": "the in-app preview, over full screen style"}


def angle_en(posture, angle):
    if posture == "closed":
        return {0: "upright", 90: "on its side, landscape right (90)", 270: "on its side, landscape left (270)"}[angle]
    return {0: "wide (951x669)", 90: "tall, turned right (90)", 270: "tall, turned left (270)"}[angle]


def state_en(state):
    su, po, an, mu = state
    return (f'{"folded, on the outer screen" if po == "closed" else "unfolded, on the inner screen"}, '
            f'{angle_en(po, an)}, {"music playing" if mu else "no music"}')


def action_en(action, state):
    """One step in words, from the state it starts in."""
    su, po, an, mu = state
    k = action[0]
    if k == "open":
        return f"Open the page in {SURFACE_EN[su]}"
    if k == "turn":
        return f"Turn the phone {angle_en(po, action[1])}"
    if k == "unfold":
        return "Unfold to the inner screen"
    if k == "fold":
        return "Fold to the outer screen"
    if k == "music":
        return "Start music (a Live Activity in the Dynamic Island)" if action[1] else "Stop the music (the Live Activity ends)"
    if k == "safari":
        return "Tap Open in Safari in the preview"
    raise ValueError(action)


def after(action, state):
    if action[0] == "open":
        return state
    return next(n for a, n in transitions(state) if a == action)


def expect_en(state):
    su, po, an, _ = state
    e = expect(state)
    if po == "closed" and su == "tab" and an:
        side = TAB[an][1]
        return f"controls in a column on the {side}; if Safari keeps its bars at the top (no column), inline on the right"
    if e.get("hidden"):
        return "controls hidden, the page keeps its full width, the preview's own buttons untouched"
    where = {"column": "in a column", "inline": "inline", "strip": "in a strip in the side inset", "both": "on both edges"}[e["mode"]]
    gap = " in the gap of the preview's own column" if e.get("gap") else ""
    return f'controls {where} on the {e["side"]}{gap}'


def steps_en(start, acts):
    """[(action, state after it, words, expected words)] for a journey, the open first."""
    out, cur = [], start
    for a in [("open",)] + list(acts):
        words = action_en(a, cur)
        cur = after(a, cur)
        out.append((a, cur, words, expect_en(cur)))
    return out


# ---- interaction suites (issue #107) --------------------------------------------------------------------------------
# A suite opens one page in one starting state, then interacts with it: taps on the page and on Duet's controls, scrolls,
# Safari's own buttons, the keyboard, a modal, the Home button, the lock button, the app switcher, the Dynamic Island.
# Device steps (turn, unfold, fold, music, Open in Safari) change the state as in a journey; the others keep it, so
# every step is judged against the placement of the state it ends in, plus its own outcome check:
#   path        the address after the step, without the e2e and s parameters ("/book?c=sauna")
#   label       Duet offers a control labelled this (on screen, or in the menu it folded into);  no_label: it does not
#   keyboard    Duet's nav carries data-keyboard;  active: the focused element's tag ("input", or None for none)
#   dialog      a page dialog is open (True) or not (False)
#   scroll_gt   the page is scrolled down more than this (pt);  scroll_lt: less than this
#   la          Live Activities running
# env: dark (appearance), content_size (Dynamic Type), set for the suite and restored after it.
TAB0, PV0 = ("tab", "closed", 0, False), ("sheet", "closed", 0, False)
CTA = [  # /book: a class row, its call to action toggling Booked, and Duet's back to the list
    (("tap", "Sauna and cold plunge"), "Tap the class \"Sauna and cold plunge\"", {"path": "/book?c=sauna", "label": "Book · 2 credits"}),
    (("tap", "Book · 2 credits"), "Tap Duet's call to action \"Book · 2 credits\"", {"label": "Booked"}),
    (("tap", "Booked"), "Tap \"Booked\" again", {"label": "Book · 2 credits"}),
    (("tap", "Classes", "back"), "Tap Duet's back \"Classes\" (from \"…\" or the tab's menu where it folded)", {"path": "/book", "no_label": "Book · 2 credits"}),
]
SUITES = [
    {"id": "ctl01", "title": "Call to action and back, Safari tab, outer screen upright", "page": "/book", "start": TAB0, "steps": CTA},
    {"id": "ctl02", "title": "Call to action and back, in-app preview (sheet)", "page": "/book", "start": PV0, "steps": CTA},
    {"id": "ctl03", "title": "Call to action and back, Safari tab, unfolded", "page": "/book", "start": ("tab", "open", 0, False), "steps": CTA},
    {"id": "ctl04", "title": "Call to action and back, Safari tab, outer screen on its side", "page": "/book", "start": ("tab", "closed", 90, False), "steps": CTA},
    {"id": "scr01", "title": "Scroll kept across turn, unfold and fold, Safari tab", "page": "/scroll", "start": TAB0, "steps": [
        (("scroll", 900), "Scroll the page down", {"scroll_gt": 500}),
        (("turn", 90), None, {"scroll_gt": 300}),
        (("turn", 0), None, {"scroll_gt": 300}),
        (("unfold",), None, {"scroll_gt": 300}),
        (("fold",), None, {"scroll_gt": 300}),
        (("scroll", -2000), "Scroll back to the top", {"scroll_lt": 50}),
    ]},
    {"id": "scr02", "title": "Scroll in the in-app preview (its top bar compacts, #104)", "page": "/scroll", "start": PV0, "steps": [
        (("scroll", 900), "Scroll the page down (the preview's top bar compacts)", {"scroll_gt": 500}),
        (("scroll", -2000), "Scroll back to the top (the top bar grows back)", {"scroll_lt": 50}),
    ]},
    {"id": "nav01", "title": "Link, Safari Back and Forward, outer screen upright", "page": "/", "start": TAB0, "steps": [
        (("tap", "Call to action example"), "Tap the link \"Call to action example\"", {"path": "/book"}),
        (("native", "BackButton"), "Tap Safari's Back", {"path": "/"}),
        (("forward",), "Swipe in from the right edge (Safari Forward)", {"path": "/book"}),
    ]},
    {"id": "nav02", "title": "Link and Safari Back, outer screen on its side", "page": "/", "start": ("tab", "closed", 90, False), "steps": [
        (("tap", "Call to action example"), "Tap the link \"Call to action example\"", {"path": "/book"}),
        (("native", "BackButton"), "Tap Safari's Back", {"path": "/"}),
    ]},
    {"id": "nav03", "title": "Link and Safari Back, unfolded", "page": "/", "start": ("tab", "open", 0, False), "steps": [
        (("tap", "Call to action example"), "Tap the link \"Call to action example\"", {"path": "/book"}),
        (("native", "BackButton"), "Tap Safari's Back", {"path": "/"}),
    ]},
    {"id": "nav04", "title": "Link and the preview's own Back, in-app preview (sheet)", "page": "/", "start": PV0, "steps": [
        (("tap", "Call to action example"), "Tap the link \"Call to action example\"", {"path": "/book"}),
        (("native", "BackButton"), "Tap the preview's Back", {"path": "/"}),
    ]},
    {"id": "kb01", "title": "Keyboard up and down, Safari tab, outer screen", "page": "/probe", "start": TAB0, "steps": [
        (("tap", "Tap to open the keyboard"), "Tap the text field (the keyboard comes up)", {"active": "input", "keyboard": True}),
        (("blur",), "Tap the page outside the field (the keyboard goes down)", {"active": None, "keyboard": False}),
    ]},
    {"id": "kb02", "title": "Keyboard up and down, Safari tab, unfolded", "page": "/probe", "start": ("tab", "open", 0, False), "steps": [
        (("tap", "Tap to open the keyboard"), "Tap the text field (the keyboard comes up)", {"active": "input", "keyboard": True}),
        (("blur",), "Tap the page outside the field (the keyboard goes down)", {"active": None, "keyboard": False}),
    ]},
    {"id": "mod01", "title": "A full-screen page dialog opened and closed (#79), Safari tab", "page": "/sheet", "start": TAB0, "steps": [
        (("tap", "Weekend in Lisbon"), "Tap \"Weekend in Lisbon\" (a full-screen dialog opens)", {"dialog": True, "label": "Close"}),
        (("turn", 90), None, {"dialog": True, "label": "Close"}),
        (("turn", 0), None, {"dialog": True}),
        (("tap", "Close"), "Tap Duet's \"Close\"", {"dialog": False, "no_label": "Close"}),
    ]},
    {"id": "la01", "title": "Live Activity expanded by a long press, Safari tab", "page": "/book", "start": ("tab", "closed", 0, True), "steps": [
        (("expand",), "Long-press the Live Activity in the Dynamic Island (it expands)", {}),
        (("blur",), "Tap the page (the Live Activity shrinks back)", {}),
    ]},
    {"id": "life01", "title": "Home, lock and the app switcher, Safari tab", "page": "/book", "start": TAB0, "steps": [
        (("tap", "Sauna and cold plunge"), "Tap the class \"Sauna and cold plunge\"", {"path": "/book?c=sauna"}),
        (("home",), "Press Home, then open Safari again", {"path": "/book?c=sauna", "label": "Book · 2 credits"}),
        (("lock",), "Lock the phone, wake it and unlock", {"path": "/book?c=sauna", "label": "Book · 2 credits"}),
        (("switcher",), "Open the app switcher and pick Safari again", {"path": "/book?c=sauna", "label": "Book · 2 credits"}),
    ]},
    {"id": "life02", "title": "Reload while unfolded, then fold", "page": "/book", "start": ("tab", "open", 0, False), "steps": [
        (("native", "ReloadButton"), "Tap Safari's Reload", {"path": "/book"}),
        (("fold",), None, {"path": "/book"}),
    ]},
    {"id": "life03", "title": "Home with the in-app preview open", "page": "/book", "start": PV0, "steps": [
        (("home",), "Press Home, then open the app again", {}),
    ]},
    {"id": "set01", "title": "In-app preview, over full screen style, turned and unfolded", "page": "/book", "start": ("over", "closed", 0, False), "steps": [
        (("turn", 90), None, {}), (("turn", 0), None, {}), (("unfold",), None, {}), (("fold",), None, {}),
    ]},
    {"id": "set02", "title": "Dark appearance, call to action, Safari tab", "page": "/book", "start": TAB0, "env": {"dark": True}, "steps": CTA[:2]},
    {"id": "set03", "title": "Largest text size, call to action, Safari tab", "page": "/book", "start": TAB0, "env": {"content_size": "accessibility-extra-extra-extra-large"}, "steps": CTA[:2]},
] + [
    {"id": f"pg{n:02}", "title": f"Page {pg}: turned, unfolded and folded, Safari tab", "page": pg, "start": TAB0, "steps": [
        (("turn", 90), None, {}), (("turn", 270), None, {}), (("turn", 0), None, {}), (("unfold",), None, {}), (("fold",), None, {}),
    ]} for n, pg in enumerate(("/", "/book", "/scroll", "/sheet", "/probe"), 1)
]
DEVICE_OPS = {"turn", "unfold", "fold", "music", "safari"}
SUITE_GAPS = [
    "Safari's tab bar at the top vs the bottom: the setting is not reachable from the simulator yet.",
    "A timer Live Activity, and two Live Activities at once: the host starts only its music activity yet.",
]


def check_en(c):
    out = []
    for k, v in c.items():
        out.append({"path": lambda: f"the address is {v}", "label": lambda: f'Duet offers "{v}"', "no_label": lambda: f'Duet no longer offers "{v}"',
                    "keyboard": lambda: "the keyboard is up (data-keyboard)" if v else "the keyboard is down",
                    "active": lambda: "the text field has focus" if v else "nothing has focus",
                    "dialog": lambda: "the dialog is open" if v else "the dialog is closed",
                    "scroll_gt": lambda: f"the page stays scrolled down (more than {v}pt)", "scroll_lt": lambda: f"the page is at the top (under {v}pt)",
                    "la": lambda: f"{v} Live Activities running"}[k]())
    return out


def suite_steps(suite):
    """[(action, state after it, words, expected words, check)] for a suite, the open first."""
    cur = suite["start"]
    out = [(("open",), cur, f'Open {suite["page"]} in {SURFACE_EN[cur[0]]}, {state_en(cur)}', expect_en(cur), {})]
    for a, words, check in suite["steps"]:
        if a[0] in DEVICE_OPS:
            words = words or action_en(a, cur)
            cur = after(a, cur)
        out.append((a, cur, words, "; ".join([expect_en(cur)] + check_en(check)), check))
    return out


def markdown():
    js = journeys()
    edges = sum(len(transitions(st)) for st in STATES)
    lines = [
        "# Duo e2e scenario catalogue",
        "",
        "Generated by `python3 tools/e2e/catalogue.py > tools/e2e/CATALOGUE.md`, do not edit by hand. Every journey sets the device up (posture, angle, music), opens the page, then applies each transition; every step is filmed and checked against EXPECTED.md on every sample. Invariants on every step: Duet's controls fully visible, never over a native button, the Dynamic Island or a Live Activity, no page content clipped, no flash in the wrong place, settled within 0.5s.",
        "",
        f"{len(STATES)} states ({len(SURFACES)} surfaces x {len(POSTURES)} postures x {len(ANGLES)} angles x music on/off), {edges} transitions, {len(js)} journeys covering every start state and every transition.",
        "",
        "Play one: `tools/e2e/run.sh --catalogue --only j07`. Play all, in parallel on the four Duo e2e simulators: `tools/e2e/matrix.sh`.",
        "",
        "Not covered by journeys:",
        "",
        *[f"- {g}" for g in GAPS],
        "",
    ]
    lines += ["# Interaction suites (#107)", "",
              "Each suite opens one page, then interacts with it; every step is filmed and judged against the placement of the state it ends in, plus its own outcome. Play one: `tools/e2e/run.sh --catalogue --only ctl01`.", "",
              "Not covered yet:", "", *[f"- {g}" for g in SUITE_GAPS], ""]
    for su in SUITES:
        lines += [f'## {su["id"]}: {su["title"]}' + (f' ({", ".join(f"{k} {v}" for k, v in su["env"].items())})' if su.get("env") else ""), ""]
        for n, (a, st, words, exp, _) in enumerate(suite_steps(su), 1):
            lines.append(f"{n}. {words}. Expect: {exp}.")
        lines.append("")
    lines += ["# Journeys", ""]
    for i, (start, acts) in enumerate(js):
        lines += [f"## {jid(i)}: {SURFACE_EN[start[0]]}, opened {state_en(start)}", ""]
        for n, (a, st, words, exp) in enumerate(steps_en(start, acts), 1):
            lines.append(f"{n}. {words}. Expect: {exp}.")
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    sys.stdout.write(markdown())
