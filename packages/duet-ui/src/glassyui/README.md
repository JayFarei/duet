# Vendored GlassyUI

`glass-surface`, `glass-provider` and their libs and `styles/liquid.css`, copied unmodified from the GlassyUI shadcn registry (https://glassyui.com, https://github.com/alexburlis/glassyui, MIT, see LICENSE) on 2026-10-24. Changes: the `clsx` import in `glass-surface.tsx` is replaced by a string join, so no new dependency; `lib/use-refraction-filter.tsx` declares `ViewTimeline`, which this TypeScript's DOM lib lacks.

Vendored rather than `shadcn add` so the library stays self-contained in `native-chrome`. On WebKit (iOS) GlassyUI renders its CSS frost (backdrop blur, saturate, tint, rim, noise); the SVG lens and refraction are Chromium-only. To update, re-download the registry items and reapply both edits.
