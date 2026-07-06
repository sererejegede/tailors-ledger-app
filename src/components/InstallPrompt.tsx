/**
 * Install-to-home-screen affordance. This is a no-op on native (the app is installed from
 * the store / dev build). The real banner lives in InstallPrompt.web.tsx, where the PWA can
 * be installed. Kept as a platform-split so callers render <InstallPrompt /> unconditionally.
 */
export function InstallPrompt() {
  return null;
}
