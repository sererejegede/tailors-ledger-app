/**
 * Web build of the app lock (spec §11 / settings). There is no biometric/passcode
 * equivalent to expo-local-authentication in the browser for v1, so the lock is simply
 * unavailable: `canUseAppLock()` returns false, which makes SettingsScreen show its
 * "App lock unavailable" notice and refuse to enable the toggle. `authenticate()` is a
 * defensive no-op that always succeeds, so a lock flag that somehow arrives enabled can
 * never trap a web user on the locked screen (AppLockGate). WebAuthn/passkeys are a
 * deliberate later enhancement — see the native lib/appLock.ts.
 */

/** No device-auth on web in v1 — the lock is always unavailable. */
export async function canUseAppLock(): Promise<boolean> {
  return false;
}

/** No-op on web: nothing to authenticate against, so never block the gate. */
export async function authenticate(_reason?: string): Promise<boolean> {
  return true;
}
