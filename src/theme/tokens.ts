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
  text: '#444748', // primary text
  muted: '#8C887E',
  faint: '#B6B1A6',
  line: '#E2DED5',
  line2: '#D2CDC2',
  danger: '#A23B2E',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
