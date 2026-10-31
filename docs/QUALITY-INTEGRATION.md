# Integrating Duet reliably

Import `duet-ui/styles.css`. Prefer `<Duet>{content}</Duet>` for app screens: its inner scroller keeps the document and Safari column still, and preserves each selected place's scroll. Use `column()` for centred reading content and `bleed()` for full-width bands. Spread helpers last; avoid double-padding their insets. Keep content mounted across folds with `DuetPanes` and stable keys.

`menu.selected` represents the current place, not an instruction to suppress navigation. `onSelect` now fires on **every** activation, including the current item. A scroll-spy page can therefore return to the top of the current section. Applications that only want changes should explicitly guard `if (id === selected) return`. Keep actions idempotent where appropriate.

```tsx
const go = (id: string) => {
  setSelected(id);
  // With children, scroll the inner scroller, not window.
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({
    block: "start", inline: "nearest",
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  }));
};
<Duet menu={{ items, selected, onSelect: go }}>{content}</Duet>
```

When intentionally using document scrolling (Duet without children), keep the document's horizontal target stable. Safari column mode reserves space differently on left columns/split view; never hard-code `left: 0` for every posture. If you compute a vertical jump, capture the current horizontal position and call `scrollTo({left: window.scrollX, top, behavior})`. Respect `scroll-margin-top`. Avoid unconditional delayed retries: they can override a user's touch or wheel input. The library still has a potential smooth-scroll cancellation path when it corrects sideways drift; see the audit and test it on hardware.

The library now positions its document-scroll sidebar in view. Do not attach a second scroll-timeline transform to that moving element. Use an independent wrapper for custom motion. Avoid root `:has()` invalidation on large pages, giant blurred shadow copies, `100lvh` overlays that extend the scroll range, and permanent `will-change` on huge layers. Profile on the real device before attributing jank to React.

Do not move the sidebar right or override its width using `!important` without checking the actual containing block in every posture. Keep the sidebar navigation non-modal: Escape returns focus and Tab exits; it does not claim a modal focus trap or make the entire app inert. For an actual modal, use an accessible dialog primitive with a focus trap and backdrop. Use `close` to let the Duet close control take over; retain a fallback close button when Duet hides controls.

Treat `.duet-group`, `.duet-rim` and layer transforms as internal details. Prefer documented theme tokens and public callbacks. Customise destructive text with `--duet-destructive` only after checking 4.5:1 contrast; decorative red badge fills are not suitable for small text. Check glass over both light and dark content, with VoiceOver and increased text size.

Use viewport-fit=cover, and let the library maintain shrink-to-fit=no. Do not apply overflow clipping to the root in Safari column mode: that removes the overflow Safari paints beside the viewport. Outset shadows and press swell may still clip at that edge on native Safari; an inset keyline avoids relying on ink overflow until physical-device validation resolves it.

For SSR, follow [server-rendering.md](server-rendering.md): use the supplied boot entry before hydration and a stable server snapshot. Do not branch initial markup on window size, emulation state, localStorage or `Date.now()`. `DuoCookie` can correct the layout after hydration; it is not proof the server knew the device. Preserve ordinary phone and desktop navigation while the snapshot settles. Decorative Safari guards now mount after hydration so server markup cannot disagree with the iframe's first client render.

Before shipping, run the [quality checklist](../CONTRIBUTING.md) and [real-device matrix](DUO-TEST-MATRIX.md). A passing screenshot of injected signals proves layout under those signals; it cannot prove that an actual Safari update emits them or paints the undocumented column the same way.
