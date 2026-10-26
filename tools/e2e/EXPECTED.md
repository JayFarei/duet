# Expected placement per state (source of truth for the e2e matrix; re-read every round, the orchestrator may update it)

Universal invariants, every state and every transition:
- Duet's controls are fully visible, never overlap Safari's or the preview's own buttons, never sit under the status bar / camera / home indicator.
- Page content is never clipped or hidden under native chrome or under Duet's controls; no horizontal overflow (document scrollWidth <= innerWidth, except the documented left-column scroll offset).
- Transitions settle to the final placement within ~0.5s, with no slow drift, no flash in the wrong place.

Per state (README "Placement" table is the spec):
- Closed, Safari tab, portrait: column, right.
- Closed, Safari tab, landscape angle 90: column, left. angle 270: column, right.
- Closed, in-app preview (SFSafariViewController sheet), all rotations: USER DECISION (2026-10-26): Duet's controls go INTO THE EMPTY GAP of the preview's own right column, between the preview's reader/menu button and its back button (in portrait roughly the band between the 2nd and 3rd native buttons, ~140pt tall on the real Duo; measure it per rotation). Compact controls (e.g. collapse to a single pill or the "…" menu plus selected tab) that fit the gap without touching any native button. The page keeps its full width (no inline strip), and nothing is clipped. Update the README "In-app preview" section and the spec accordingly. In rotations where no usable gap exists, fall back to the least intrusive option and document it.
- Closed, preview -> "Open in Safari": becomes the tab placement above.
- Unfolded, full width: inline (user side, default right).
- Unfolded, split view, left pane and right pane: column (both edges drawn as documented); moving between panes and back to full width re-places correctly.
- Unfolded rotations (landscape both turns), split and full.
- Fold/unfold transitions between all of the above.

User notes:
- 2026-10-26: preview placement = gap in the preview's column (see above). The left inline strip is wrong.
