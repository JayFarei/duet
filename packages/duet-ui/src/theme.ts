// The small theming surface: an accent (iOS tintColor), an appearance (overrideUserInterfaceStyle) and how
// your icons are drawn. Everything lands as --duet-* custom properties on each strip, so plain CSS can set the
// same tokens instead (see duet.css). No JSX here, so the tests import it directly.

/** Light or dark, or follow the system. */
export type Appearance = "auto" | "light" | "dark";

/** How the app's own icons are drawn. The chrome's system glyphs (back, close, "…", search) keep theirs. */
export interface DuetIcons {
  /** Icons in round buttons, groups and menus. Number is px. Default 22. */
  size?: number | string;
  /** @deprecated Unused since 0.6 (no tab pill), kept so older code still typechecks. */
  tabSize?: number | string;
  /** Stroke width of SVG line icons (Lucide and the like), the way SF Symbols have a weight. Default 2. */
  weight?: number;
  /** Colour of icons that are not selected. Default: the ink, black in light and white in dark. */
  color?: string;
}

export interface DuetTheme {
  /** Accent for the selected tab, the active menu item and the primary button, like iOS's tintColor. */
  tint?: string;
  icons?: DuetIcons;
}

const px = (v: number | string) => (typeof v === "number" ? `${v}px` : v);

/** The custom properties a theme sets; unset fields are left to the stylesheet (and to your CSS). */
export function themeVars({ tint, icons = {} }: DuetTheme): Record<string, string> {
  const v: Record<string, string> = {};
  if (tint) v["--duet-tint"] = tint;
  if (icons.size !== undefined) v["--duet-icon-size"] = px(icons.size);
  if (icons.tabSize !== undefined) v["--duet-tab-icon-size"] = px(icons.tabSize);
  if (icons.weight !== undefined) v["--duet-icon-weight"] = String(icons.weight);
  if (icons.color) v["--duet-icon"] = icons.color;
  return v;
}

/** GlassyUI's theme for an appearance (and the older `dark` flag): undefined follows the system. */
export function glassTheme(appearance?: Appearance, dark?: boolean): "light" | "dark" | undefined {
  if (appearance && appearance !== "auto") return appearance;
  if (appearance === "auto") return undefined;
  return dark === undefined ? undefined : dark ? "dark" : "light";
}
