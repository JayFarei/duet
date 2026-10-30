/** The hero's "Copy prompt for your agent": what a coding agent needs to make a web app Duo-ready with duet-ui. It
 *  points at the README for the details, so it stays short and does not drift from the docs. */
export const AGENT_PROMPT = `Make this web app Duo-ready with duet-ui (https://getduet.dev): native-feeling side controls on the iPhone Duo, and a sensible layout everywhere else.

Read the README first and work from it, not from memory: https://github.com/JayFarei/duet#readme, especially "Quick start", "Props", "The template", "Call to action", "Laying out content", "Modals and sheets in column mode" and "Edge cases". If something there doesn't fit this app, say so instead of guessing.

1. Install: npm i duet-ui. It needs React 18.3 or newer and a bundler that imports CSS from packages. In the Next.js App Router, components that use Duet are client components.
2. Map the app's navigation onto Duet's one template, which is fixed and the same on every layout: a burger, then the page's key actions while they fit, then "…" holding the rest, and at most one primary, a tinted button in a slot of the controls whose tap grows into a confirmation. There are no tabs, no tab bar, no back button prop, no island and no accessory bar. Top-level places (sections, mailboxes, tabs in the old app) become menu items ({ id, label, icon? }, declared as const so onSelect takes the state setter): the burger opens them in a sidebar and slides the page aside, and each place keeps its scroll position. Header buttons become actions ({ id, label, icon, onPress }): put the two or three that matter first, mark secondary ones folded: true and destructive ones destructive: true, both of which only show in "…". A back link becomes an action (an arrow, first) or goes away if the menu already reaches that place. The screen's one main action (compose, book, buy) becomes primary: a tap grows it into a confirmation box whose button (confirm: "Book with 2 credits", or confirm: false to run at once) runs it. Reuse the app's icons at 21 to 22pt. Remove the app's own tab bar and header buttons where Duet now draws them, so there are never two.
3. Wrap the app: <Duet menu={{ items, selected, onSelect }} actions={...} primary={...}>{page}</Duet>. Pass the page as children, so it scrolls in Duet's inner scroller, the controls stay still and the burger can slide it aside. Theme with tint, appearance and icons only.
4. Lay out content with column(maxWidth, pad) for reading columns and bleed(pad) for full-width bands, or the --duet-inset-left / --duet-inset-right CSS variables. Backgrounds run under the controls, only text and buttons keep clear. Size full-screen sections with min-height: var(--duet-vh, 100svh). Don't set margin on <html>, don't reset scrollX, don't set viewport-fit=contain.
5. Sheets and modals: use a fixed <div> scrim, not <dialog>.showModal(). While one is open, pass close={{ label: "Close", onPress: closeSheet }} to <Duet>, calling the same close path as the sheet's own X, and hide that X while Duet shows its close: html[data-duet-close] .sheet-close { display: none; } If the scrim blurs, put backdrop-filter on a ::before (absolute, inset 0, z-index -1), not the scrim, so Safari's top bar dims with it.
6. Decide where Duet renders. On devices that are not a Duo it draws an inline layout. If the app should keep its own phone or desktop navigation there, render <Duet> only where useDuet().duo is true, and use <DuoCookie> to choose on the server without a layout flash.
7. Go through every "You do" line under "Edge cases" and check this app breaks none of them (for example a global animation: none !important reset that catches .duet, popovers that cross the column above --duet-safe-top-column, overscroll-behavior on html or body).

Verify on an iPhone Duo or the Duo simulator, in Safari and as a Home Screen app:
- closed, portrait: controls in Safari's column, page not clipped
- split view, left and right pane: page starts beside the column, nothing clipped
- closed and turned, and unfolded (inline): controls in place, content clear of them
- scroll to the very top and bottom and fling: controls stay put, no bounce
- the burger opens the places and slides the page aside; "…" opens its list and closes on a tap outside
- the primary arms on the first tap and runs on the second
- a sheet open: the column shows only the close button, and it closes the sheet
- a text field focused: no zoom out
Then check a desktop browser and a regular iPhone still look right.

Report what you changed, what you verified (pass or fail for each line above), and anything the README should have told you.
`;
