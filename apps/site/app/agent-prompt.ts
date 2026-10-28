/** The hero's "Copy prompt for your agent": what a coding agent needs to make a web app Duo-ready with duet-ui. It
 *  points at the README for the details, so it stays short and does not drift from the docs. */
export const AGENT_PROMPT = `Make this web app Duo-ready with duet-ui (https://getduet.dev): native-feeling side controls on the iPhone Duo, and a sensible layout everywhere else.

Read the README first and work from it, not from memory: https://github.com/JayFarei/duet#readme, especially "Quick start", "Props", "Laying out content", "Modals and sheets in column mode" and "Edge cases". If something there doesn't fit this app, say so instead of guessing.

1. Install: npm i duet-ui. It needs React 18.3 or newer and a bundler that imports CSS from packages. In the Next.js App Router, components that use Duet are client components.
2. Map the app's navigation onto Duet's props. Top-level sections become tabs ({ id, label, icon }, typed as const so onSelect takes the state setter). Header buttons become actions, the screen's main action (compose, new) becomes primary, a back link becomes back. Reuse the app's icons: 24pt in tabs, 21 to 22pt on round buttons. Remove the app's own tab bar and header buttons where Duet now draws them, so there are never two.
3. Wrap the app: <Duet tabs={{ items, selected, onSelect }} actions={...} minimizeOnScroll>{page}</Duet>. Pass the page as children, so it scrolls in Duet's inner scroller and the controls stay still.
4. Lay out content with column(maxWidth, pad) for reading columns and bleed(pad) for full-width bands, or the --duet-inset-left / --duet-inset-right CSS variables. Backgrounds run under the controls, only text and buttons keep clear. Size full-screen sections with min-height: var(--duet-vh, 100svh). Don't set margin on <html>, don't reset scrollX, don't set viewport-fit=contain.
5. Sheets and modals: use a fixed <div> scrim, not <dialog>.showModal(). While one is open, pass close={{ label: "Close", onPress: closeSheet }} to <Duet>, calling the same close path as the sheet's own X, and hide that X in column mode: html[data-duet-mode="column"] .sheet-close { display: none; } If the scrim blurs, put backdrop-filter on a ::before (absolute, inset 0, z-index -1), not the scrim, so Safari's top bar dims with it.
6. Decide where Duet renders. On devices that are not a Duo it draws an inline layout. If the app should keep its own phone or desktop navigation there, render <Duet> only where useDuet().duo is true, and use <DuoCookie> to choose on the server without a layout flash.
7. Go through every "You do" line under "Edge cases" and check this app breaks none of them (for example a global animation: none !important reset that catches .duet, popovers that cross the column above --duet-safe-top-column, overscroll-behavior on html or body).

Verify on an iPhone Duo or the Duo simulator, in Safari and as a Home Screen app:
- closed, portrait: controls in Safari's column, page not clipped
- split view, left and right pane: page starts beside the column, nothing clipped
- closed and turned, and unfolded (inline): controls in place, content clear of them
- scroll to the very top and bottom and fling: controls stay put, no bounce
- a sheet open: the column shows only the close button, and it closes the sheet
- a text field focused: no zoom out
Then check a desktop browser and a regular iPhone still look right.

Report what you changed, what you verified (pass or fail for each line above), and anything the README should have told you.
`;
