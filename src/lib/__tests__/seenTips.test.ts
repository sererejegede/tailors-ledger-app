// In-memory AsyncStorage mock so the seen-flag helper is testable off-device.
jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store[k] ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        store[k] = v;
      }),
      removeItem: jest.fn(async (k: string) => {
        delete store[k];
      }),
      __reset: () => {
        store = {};
      },
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasSeenTip, markTipSeen, resetTips } from '../seenTips';

beforeEach(() => (AsyncStorage as unknown as { __reset: () => void }).__reset());

describe('seenTips', () => {
  it('reports a tip as unseen until marked, then seen', async () => {
    expect(await hasSeenTip('swipe')).toBe(false);
    await markTipSeen('swipe');
    expect(await hasSeenTip('swipe')).toBe(true);
    expect(await hasSeenTip('other')).toBe(false);
  });

  it('marking the same tip twice does not duplicate it', async () => {
    await markTipSeen('swipe');
    await markTipSeen('swipe');
    expect(await hasSeenTip('swipe')).toBe(true);
  });

  it('resetTips clears every seen flag', async () => {
    await markTipSeen('swipe');
    await markTipSeen('jump');
    await resetTips();
    expect(await hasSeenTip('swipe')).toBe(false);
    expect(await hasSeenTip('jump')).toBe(false);
  });
});
