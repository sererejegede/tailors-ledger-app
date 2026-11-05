/**
 * Design tokens. Layout/interaction come from docs/tailor-app-wireframe.html, but the
 * palette is the higher-fidelity brand direction (build-plan Phase 3): a single
 * tailor's-tape accent for focus + primary actions, on a warm paper background.
 * Structural roles (muted/faint/line) are borrowed from the wireframe :root.
 */
export const colors = {
  accent: '#810B38', // brand accent — focus + primary actions
  accentTint: '#F6E7EC', // active-row background wash
  accentInk: '#5E0827', // value text on the active item
  bg: '#FAF9F6', // body background (paper)
  surface: '#FFFFFF',
  dockBg: '#FBF8F1', // docked input background (wireframe)
  text: '#2F3132', // ink: primary text
  muted: '#6F6B62', // grey: secondary text, dark enough to read
  faint: '#B6B1A6',
  line: '#E2DED5',
  line2: '#D2CDC2',
  danger: '#A23B2E',
  dangerTint: '#F8E9E6', // behind a red warning tag ("Check: usually 14–20″")
  ok: '#3F7A4E', // the backup card's dot once a backup has gone through
  warn: '#B7791F', // the backup card's dot when a backup is stuck
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
// The redesign uses three corner sizes (CLAUDE-app.md "Screen rules"):
// `round` for anything tapped on one line (buttons, chips, keys, fields), `card` for
// cards, notes, photos and receipts, and `sheet` for the top corners of sheets.
// `sm`/`lg`/`default`/`pill` are the old sizes; they go once every screen has moved over.
export const radius = { sm: 8, md: 16, lg: 24, default: 32, pill: 999, round: 999, card: 16, sheet: 24 } as const;

// Type scale — Tailwind's font sizes (px). `xxs` (10) is a local extension below Tailwind's
// smallest step (`xs` 12) for tiny badges/labels. Use these instead of literal fontSizes so
// the app's type sizing stays centralized and consistent.
export const fontSizes = {
  xxs: 10,
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export type Color = (typeof colors)[keyof typeof colors];
export type Space = (typeof space)[keyof typeof space];
export type Radius = (typeof radius)[keyof typeof radius];
export type FontSize = (typeof fontSizes)[keyof typeof fontSizes];