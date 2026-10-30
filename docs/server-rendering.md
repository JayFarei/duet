# Server rendering and hydration

[Back to the README](../README.md)

The server can't measure anything, so on the server and during hydration `useDuet()` returns a fixed snapshot: `mode: "column"`, `duo: true`, `browser: "safari"`, `layout: "narrow"`, `side: "right"` (a closed Safari tab). The real values arrive right after hydration. So `useDuet().duo` is `true` in the server HTML on every device: a page that renders a Duo layout or a desktop layout from it switches once after hydration on non-Duo devices.

To choose the layout on the server, `<DuoCookie>` keeps a `duet-duo` cookie (`"1"` on a Duo) in step with the browser. Read the cookie on the server, render from it, and pass what you rendered as `rendered`. After hydration, if the browser's answer differs, `<DuoCookie>` updates the cookie and calls `onChange` (default: `location.reload()`), so a new device switches layout once: expect one reload on the first visit from a device the cookie has not seen (a Duo, when the server rendered for a non-Duo, or the other way round), and none after. It renders nothing and works outside `<Duet>`. In the Next.js App Router:

```tsx
// app/page.tsx, a server component. DuoApp and DesktopApp are your own components.
import { cookies } from "next/headers";
import { DuoCookie } from "duet-ui";

export default async function Page() {
  const duo = (await cookies()).get("duet-duo")?.value === "1";
  return (
    <>
      <DuoCookie rendered={duo} />
      {duo ? <DuoApp /> : <DesktopApp />}
    </>
  );
}
```

Pass `onChange={() => router.refresh()}` from a client component to re-render without a reload.

## Pre-paint boot

`useDuet()` and `<Duet>` only know the mode once React mounts, so CSS keyed on `html[data-duet-mode="column"]` (a band bled into Safari's column, page controls moved there) would paint the plain layout first. Inline `bootScript` as the first child of `<body>`: it runs `detect()` before the first paint and, in column mode only, sets `data-duet-mode="column"`, `data-duet-boot` and `--duet-column`, `--duet-vh` and `--duet-inset-bottom` on `<html>`. Every other browser and device is left untouched. Once mounted, `<Duet>` takes the values over, or `useDuet()` removes them if the page is not in the column after all.

```tsx
// app/layout.tsx
import { bootScript } from "duet-ui/boot";

<html suppressHydrationWarning>
  <body>
    <script dangerouslySetInnerHTML={{ __html: bootScript }} />
    {children}
  </body>
</html>
```

`suppressHydrationWarning` on `<html>` because the script changes its attributes before React hydrates. `--duet-column` is the column's width (0px outside column mode once mounted).
