// What the "With Duet" preview of any site is made of: the page's own header links and buttons, each mapped to the
// Duet control it would be in a native app. Shared by the shell, which reads them off the page, and
// /duo3d/optimize, which asks the decision model.

export interface Candidate {
  /** Index into the page's candidates, also data-duo3d-c on the element. */
  id: number;
  text: string;
  tag: string;
  href?: string;
  /** "header", "nav" or "top": where on the page it sits. */
  region: string;
}

export const ROLES = {
  tab: "A top-level section of the site that a native app would put in its tab bar, e.g. Products, Pricing, Docs, Blog, Shop",
  primary: "The site's single main call to action, e.g. Sign up, Get started, Start free trial, Buy, Book a demo",
  action: "A utility for the current page that a native app puts in its toolbar, e.g. Sign in, Account, Cart, Contact sales, Language",
  search: "Opens search",
  none: "Something the app would not need or already has: the logo or homepage link (the app has Home), the button that opens or closes the site's own menu, Back or Close inside that menu, carousel or slide controls, a skip link, a cookie or legal link, a promo banner, decoration or page content",
} as const;
export type Role = keyof typeof ROLES;

/** lucide icons a control can take; the model picks one by the control's meaning. */
export const ICONS = [
  "home", "tag", "box", "layers", "book", "code", "newspaper", "users", "building", "briefcase", "message-circle",
  "help-circle", "search", "shopping-cart", "user", "log-in", "rocket", "calendar", "play", "download", "graduation-cap",
  "compass", "grid", "map-pin", "globe", "star", "heart", "mail", "phone", "file-text", "image", "bell", "settings",
] as const;
export type Icon = (typeof ICONS)[number];

export interface Mapped { role: Role; p: number; icon: Icon }
export type Optimized = Record<number, Mapped>;
