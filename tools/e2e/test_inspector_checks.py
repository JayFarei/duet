"""Synthetic assertion tests, not simulator evidence: python3 -m unittest discover -s tools/e2e -p 'test_*.py'."""
import unittest
from inspector_checks import capsule_flash, outcome
import catalogue


def sample(selected, labels, **nav):
    return {"inspector": {"selected": selected, "level": "full" if selected else "closed"},
            "navs": [{"slots": [{"visibleLabels": labels}], **nav}]}


class InspectorChecks(unittest.TestCase):
    def test_wrong_owner_in_both_directions(self):
        self.assertIsNotNone(capsule_flash(sample("rent", ["Household"])))
        self.assertIsNotNone(capsule_flash(sample("", ["Next card"])))

    def test_correct_owner_and_folded_commands(self):
        for selected, labels in [("rent", ["Close", "Next card"]), ("rent", ["More"]), ("", ["Household"])]:
            self.assertIsNone(capsule_flash(sample(selected, labels)))

    def test_transit_background_and_other_pages(self):
        self.assertIsNone(capsule_flash(sample("rent", ["Household"], hidden="moving")))
        self.assertIsNone(capsule_flash({**sample("rent", ["Household"]), "visible": "hidden"}))
        self.assertIsNone(capsule_flash(sample(None, ["Household"])))

    def test_endpoint_requires_reported_state_and_identity(self):
        check = {"inspector": "full", "card": "rent"}
        self.assertEqual(outcome(sample("rent", []), check), [])
        self.assertEqual(len(outcome({}, check)), 2)
        self.assertEqual(len(outcome(sample("groceries", []), check)), 1)

    def test_suites_have_expected_steps_and_initial_assertions(self):
        suites = {s["id"]: s for s in catalogue.SUITES if s["id"].startswith("ins")}
        self.assertEqual(set(suites), {"ins01", "ins02", "ins03", "ins04"})
        for suite in suites.values():
            steps = catalogue.suite_steps(suite)
            self.assertEqual(steps[0][-1]["inspector"], "closed")
            self.assertTrue(all(step[-1].get("inspector") for step in steps))
        self.assertEqual([s[0] for s in suites["ins04"]["steps"][-3:]], [("split", "left"), ("split", "right"), ("split-full",)])


if __name__ == "__main__":
    unittest.main()
