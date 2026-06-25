import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Device-level app lock (spec §11 / settings). Uses the device's biometrics or passcode
 * via expo-local-authentication. Purely local — no account, no secret stored by us.
 */

/** True if the device can authenticate (has hardware AND an enrolled biometric/passcode). */
export async function canUseAppLock(): Promise<boolean> {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && enrolled;
}

/** Prompt the device auth. Resolves true on success. Falls back to device passcode. */
export async function authenticate(reason = 'Unlock Tailor’s Ledger'): Promise<boolean> {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    disableDeviceFallback: false,
  });
  return res.success;
}
