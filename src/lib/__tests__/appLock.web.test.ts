import { canUseAppLock, authenticate } from '../appLock.web';

/**
 * Web build of the app lock: the browser has no biometric/passcode equivalent in v1, so the
 * feature reports unavailable (SettingsScreen then refuses the toggle) and authenticate is a
 * safe no-op that can never trap a user on the locked gate.
 */
describe('appLock (web)', () => {
  it('reports the lock as unavailable on web', async () => {
    await expect(canUseAppLock()).resolves.toBe(false);
  });

  it('authenticate is a no-op that always succeeds', async () => {
    await expect(authenticate()).resolves.toBe(true);
  });
});
