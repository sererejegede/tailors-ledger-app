/**
 * "Update available" prompt — no-op on native (apps update through the store / dev build).
 * The real prompt lives in PwaUpdatePrompt.web.tsx, where a waiting service worker means a
 * new PWA version is ready. Kept as a platform split so callers render it unconditionally.
 */
export function PwaUpdatePrompt() {
  return null;
}
