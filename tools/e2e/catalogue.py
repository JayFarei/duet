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
              "full": "the in-app preview, full screen style"}


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
    for i, (start, acts) in enumerate(js):
        lines += [f"## {jid(i)}: {SURFACE_EN[start[0]]}, opened {state_en(start)}", ""]
        for n, (a, st, words, exp) in enumerate(steps_en(start, acts), 1):
            lines.append(f"{n}. {words}. Expect: {exp}.")
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    sys.stdout.write(markdown())
