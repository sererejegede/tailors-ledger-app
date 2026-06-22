import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Frac } from '@/components/FracChips';
import { composeInches, formatInches } from '@/lib/units';

/**
 * Entry-screen state machine, ported from the wireframe (`renderEntry`/`commitNext`).
 * Keeps the in-progress values in component state (the dock buffer is whole + fraction);
 * persistence is the screen's job (saveMeasurements on save). `commitNext` writes the
 * buffer to the active item and auto-advances to the next EMPTY item, wrapping.
 */
export type EntrySeed = { itemId: string; key: string; initial: number | null };
export type EntryRow = { itemId: string; key: string; value: number | null; changed: boolean };
export type Edit = { itemId: string; value: number };

export type MeasurementEntry = {
  rows: EntryRow[];
  active: number;
  filled: number;
  total: number;
  dock: { itemKey: string; display: string; placeholder: boolean; frac: Frac };
  press: (d: string) => void;
  del: () => void;
  setFrac: (f: Frac) => void;
  commitNext: () => void;
  tapRow: (i: number) => void;
  getEdits: () => Edit[];
};

const MAX_WHOLE_DIGITS = 2; // inches 0–99

export function useMeasurementEntry(seed: EntrySeed[]): MeasurementEntry {
  const initialMap = useMemo(
    () => Object.fromEntries(seed.map((s) => [s.itemId, s.initial])),
    [seed],
  );

  const [values, setValues] = useState<Record<string, number | null>>(initialMap);
  const [active, setActive] = useState(0);
  const [whole, setWhole] = useState('');
  const [frac, setFracState] = useState<Frac>(0);

  // Absorb newly added (ad-hoc) items without clobbering entered values.
  useEffect(() => {
    setValues((prev) => {
      let added = false;
      const next = { ...prev };
      for (const s of seed) {
        if (!(s.itemId in next)) {
          next[s.itemId] = s.initial;
          added = true;
        }
      }
      return added ? next : prev;
    });
  }, [seed]);

  const resetBuf = useCallback(() => {
    setWhole('');
    setFracState(0);
  }, []);

  const press = useCallback((d: string) => {
    setWhole((w) => (w.length < MAX_WHOLE_DIGITS ? w + d : w));
  }, []);

  const del = useCallback(() => {
    setWhole((w) => {
      if (w !== '') return w.slice(0, -1);
      setFracState(0);
      return w;
    });
  }, []);

  const setFrac = useCallback((f: Frac) => setFracState(f), []);

  const activeItem = seed[active];

  const commitNext = useCallback(() => {
    const committed =
      whole !== '' || frac > 0 ? composeInches(parseInt(whole || '0', 10), frac) : null;
    const newValues =
      committed != null && activeItem
        ? { ...values, [activeItem.itemId]: committed }
        : values;
    if (committed != null) setValues(newValues);
    resetBuf();

    // advance to the next empty item (wrapping); else just step forward
    let nextIdx = -1;
    for (let step = 1; step <= seed.length; step++) {
      const idx = (active + step) % seed.length;
      if ((newValues[seed[idx].itemId] ?? null) == null) {
        nextIdx = idx;
        break;
      }
    }
    setActive(nextIdx >= 0 ? nextIdx : Math.min(active + 1, seed.length - 1));
  }, [whole, frac, values, activeItem, active, seed, resetBuf]);

  const tapRow = useCallback(
    (i: number) => {
      setActive(i);
      resetBuf();
    },
    [resetBuf],
  );

  const rows: EntryRow[] = seed.map((s) => {
    const v = values[s.itemId] ?? null;
    return { itemId: s.itemId, key: s.key, value: v, changed: v != null && v !== initialMap[s.itemId] };
  });

  const getEdits = useCallback(
    (): Edit[] =>
      seed
        .map((s) => ({ itemId: s.itemId, value: values[s.itemId] }))
        .filter((e): e is Edit => e.value != null),
    [seed, values],
  );

  const activeValue = activeItem ? values[activeItem.itemId] ?? null : null;
  const typing = whole !== '' || frac > 0;
  const dock = {
    itemKey: activeItem?.key ?? '',
    display: typing
      ? formatInches(composeInches(parseInt(whole || '0', 10), frac))
      : formatInches(activeValue),
    placeholder: !typing,
    frac,
  };

  return {
    rows,
    active,
    filled: rows.filter((r) => r.value != null).length,
    total: rows.length,
    dock,
    press,
    del,
    setFrac,
    commitNext,
    tapRow,
    getEdits,
  };
}
