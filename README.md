# Duet

Native-feeling controls for React web apps on the foldable iPhone. Your page and its control strip, playing together.

```sh
npm i duet-ui
```

| Strip | Column | Inline |
| --- | --- | --- |
| ![Strip: a Home Screen app with the island menu](docs/media/strip.webp) | ![Column: Safari's empty column holds the controls, morph menu](docs/media/column.webp) | ![Inline: unfolded, the strip drags to either side](docs/media/inline-drag.webp) |

Recorded on the iPhone Duo simulator, framed by [`tools/media`](tools/media).

## Why

On the closed Duo, Safari keeps a narrow column beside the page for its own buttons, and a Home Screen app owns the whole display. iOS puts navigation in a vertical strip at the screen's edge, not a bottom tab bar. A web page that ignores this ends up with its own bar fighting Safari's, or its buttons under the camera. Duet works out where the page is running and draws back, actions and tabs where a native app would.

## Usage

```tsx
import { Duet } from "duet-ui";
import "duet-ui/styles.css";

export function App() {
  const [tab, setTab] = useState("home");
  return (
    <Duet
      tabs={{ items: TABS, selected: tab, onSelect: setTab }}
      actions={[{ id: "share", label: "Share", icon: <Share />, onPress: share }]}
      minimizeOnScroll
    >
      <Page tab={tab} />
    </Duet>
  );
}
```

Add `viewport-fit=cover` to the viewport meta so the safe areas reach the page. Duet appends `shrink-to-fit=no` itself, so Safari doesn't zoom a split-view pane out to fit the column layer. On other phones and browsers Duet falls back to the `inline` strip.

## Modes

Duet picks a mode from the window size, safe areas and display mode. `useDuet()` returns it.

| Mode | When | Controls |
| --- | --- | --- |
| `strip` | Home Screen app, closed | In the slim strip beside the page, like a native app |
| `column` | Safari tab, closed or a split-view pane | Painted into the column Safari leaves empty, so the page keeps its full width. In split view both columns get the controls, since a pane can't tell which side it is on, and each shows only its own |
| `inline` | Unfolded, landscape, in-app preview | An 84pt strip inside the page. Drag it to either side; the choice is remembered |

### Claimable space

Each mode has a band the controls may use, and Duet keeps every control inside it, so you never position anything yourself:

- **Above:** the status bar and Dynamic Island, and in Safari its own back and bookmarks buttons at the top of the column (in a split-view pane, wherever that pane puts them). Live Activities grow the island down the strip and push Safari's buttons with it, and a page can't tell, so the band always assumes the worst case, two activities. The space they would take stays empty even when none are running.
- **Below:** Safari's +/tabs pill, or the home indicator.
- **What does not fit folds into "…"**, in this order: actions, then `leading`, then back. Tabs shrink to the selected one first. "…" always gets a slot: where the band holds only two buttons (a closed Safari tab), `primary` folds too, as the menu's first item.

`useDuet()` gives the mode; the band follows from it. The menus ("island" or "morph") open over the page and close back into their button.

### Only on the Duo

`useDuet().duo` is true on an iPhone Duo in any posture, Safari or Home Screen, and false on other phones and desktops. It works outside `<Duet>`, so an existing app can switch to a Duo layout on it: render `<Duet>` only when it is true. `isDuo(signals)` is the same check for your own signals. The server can't tell, so before hydration `duo` is true; remember the answer in a cookie if the server should render the right layout first.

### In-app preview

Links opened from social and mail apps land in the in-app Safari preview (`SFSafariViewController`). On the closed Duo its window is a fixed 375x667 at 3x, a size no iPhone has natively, and its own close and share buttons sit where the column would. Duet detects it, switches to `inline` on the left, and sets `useDuet().preview`.

## Props

| Prop | What it does |
| --- | --- |
| `back` | Back button at the top of the strip: `{ label?, onPress }` |
| `leading` | Its own group under back, like SwiftUI `.topBarLeading` |
| `actions` | Like `.primaryAction`; collapses into "…" when it would reach the tabs. Items with `destructive: true` only ever show in "…", last, in red |
| `primary` | The one main action (compose, new). Narrow: just above the tabs. Wide: under back, at the top. Folds into "…" last, only when the band has no room for both |
| `tabs` | `{ items, selected, onSelect, search? }`. `search` adds a search tab as the last item |
| `searchButton` | A round search button at the bottom when there are no tabs |
| `close` | A sheet or card is open: the strip holds only a close button until it is cleared |
| `accessory` | A view docked by the tabs, like `.tabViewBottomAccessory` (a mini player) |
| `minimizeOnScroll` | Scrolling down shrinks the tabs to one button, like `.tabBarMinimizeBehavior(.onScrollDown)` |
| `menuStyle` | How "…" and the minimized tab open: `"island"` or `"morph"` (below) |
| `dark` | Force a theme. Default: follow the system |
| `children` | Page content, in an inner scroller so the chrome stays still during momentum scroll |

Each `DuetItem` is `{ id, label, icon, onPress?, badge?, tint?, destructive? }`.

### Menu styles

- `"island"` (default): the button stretches sideways into a pill of icons, like the Dynamic Island. Best when the icons speak for themselves.
- `"morph"`: the button grows into a labelled list, like a context menu. Best when items need their names.

Both are live on the [site](apps/site): scroll until the tabs shrink, tap the button, and switch styles in the Menus card.

### Laying out content

The page spans the whole window and the controls float over it, so backgrounds run on under them and the layout is asymmetric, like a native app. Only text and buttons keep clear.

- `column(maxWidth, pad)`: a centred reading column. It centres on the whole window and moves aside from the controls only as far as it must. The `duet-column` class does the same in CSS (`--duet-max`, `--duet-pad`).
- `bleed(pad)`: a full-width band (hero, sticky bar, list row). The band runs under the controls, its content is padded back beside them. `bleed(false)` runs content itself edge to edge (a map, an image).

The insets are exposed as `--duet-inset-left`, `--duet-inset-right` and `--duet-inset-top` (the strip's top blur in Home Screen apps). Inside `<DuetPanes>` each pane gets its own: only the pane next to the controls is inset.

## Panes

Apps with a path of screens (mailboxes, inbox, message) follow the fold with `<DuetPanes>`: closed or in split view one pane shows, unfolded two adjacent panes show side by side. Going deeper slides the pair along the path instead of opening a modal. Unfolding slides the neighbouring pane in, and folding plays the same motion backwards. Every pane stays mounted, so drafts and scroll positions survive the fold.

```tsx
import { Duet, DuetPanes, usePanes } from "duet-ui";

const PATH = ["mailboxes", "inbox", "message"];

export function Mail() {
  const nav = usePanes(PATH);
  return (
    <Duet back={nav.back}>
      <DuetPanes path={PATH} at={nav.at} panes={{
        mailboxes: <Mailboxes onOpen={() => nav.go("inbox")} />,
        inbox: <InboxList onOpen={() => nav.go("message")} />,
        message: <Message />,
      }} />
    </Duet>
  );
}
```

`<DuetPaneBar>` is the pane's header pill: close, a full-screen toggle (wide only) and "…" with the pane's own actions, destructive ones last. `nav.toggle` gives the focused pane the whole window (`expanded`); back leaves full screen before it steps along the path.

`minimizeOnScroll` follows whichever pane scrolls. `useDuet().layout` is `"wide"` when the page has room for two panes (600pt beside the controls: the open Duo at full width) and `"narrow"` otherwise, from the page width rather than the posture. `nav.back` steps back along the path and is `false` when that would change nothing on screen, so the back button only shows when it does something. Try it on the [site](apps/site) at `/panes`.

## Examples

| App | Shows | Run |
| --- | --- | --- |
| [Almanac](examples/almanac) | Reading app on `<DuetPanes>`: the list beside the story unfolded, a pane bar, tabs with search, morph menus, sticky title with `bleed` | `pnpm --filter @duet/example-almanac dev`, port 3101 |
| [Encore](examples/encore) | Music player: badges, mini player `accessory`, island menus, carousels with `bleed` | `pnpm --filter @duet/example-encore dev`, port 3103 |
| [Meridian](examples/meridian) | Transit map on Vite: `leading`, a full-screen map with `bleed(false)` | `pnpm --filter @duet/example-meridian dev`, port 3102 |

`pnpm dev` from the root builds the library and starts the site and every example.

## Repo

| Path | What |
| --- | --- |
| [`packages/duet-ui`](packages/duet-ui) | The library |
| [`apps/site`](apps/site) | Docs site. On a desktop it runs itself inside a web Duo you can fold, rotate and scrub through the fold (with ¼ speed) |
| [`examples`](examples) | Example apps |
| [`tools/simulator`](tools/simulator) | Driving the iPhone Duo simulator |
| [`tools/media`](tools/media) | Framing simulator recordings for docs |
| [`e2e`](e2e) | Playwright tests |

```sh
pnpm install
pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e
```

## License

MIT. Not affiliated with Apple.
