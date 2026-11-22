"""Inspector-specific assertions over recorded DOM evidence, also used by offline rerender."""


def outcome(sample, check):
    state = sample.get("inspector") or {}
    return [f"inspector {field} is {state.get(field)!r}, expected {check[key]!r}"
            for key, field in (("inspector", "level"), ("card", "selected"))
            if key in check and state.get(field) != check[key]]


def capsule_flash(sample):
    """Wrong-owner labels in a visible capsule. Hidden/transit navs cannot flash.

    Labels may fold into More; command availability is checked separately at the settled endpoint.
    Only the inspector lab declares data-inspector-selected, so other pages are untouched.
    """
    state = sample.get("inspector") or {}
    if state.get("selected") is None or sample.get("visible") == "hidden":
        return None
    labels = {label for nav in sample.get("navs", []) if not nav.get("hidden")
              for slot in nav.get("slots", []) for label in slot.get("visibleLabels", [])}
    wrong = labels & ({"Household"} if state["selected"] else {"Close", "Full screen", "Side by side", "Previous card", "Next card"})
    return f"inspector capsule flashed wrong-owner labels: {', '.join(sorted(wrong))}" if wrong else None
