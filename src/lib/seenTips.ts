import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * "Seen" flags for the one-time coach-marks (see components/CoachMark). Purely local UI
 * state — stored in AsyncStorage under a single JSON array of dismissed tip ids, so it
 * needs no DB migration and never crosses the sync wire. Resetting (Settings → "How to
 * use") clears the lot so every tip resurfaces.
 */
const KEY = 'coachmarks.seen.v1';

async function readSeen(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function hasSeenTip(id: string): Promise<boolean> {
  return (await readSeen()).includes(id);
}

export async function markTipSeen(id: string): Promise<void> {
  const seen = await readSeen();
  if (seen.includes(id)) return;
  await AsyncStorage.setItem(KEY, JSON.stringify([...seen, id]));
}

/** Clear every seen flag so all coach-marks show again (Settings replay). */
export async function resetTips(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
