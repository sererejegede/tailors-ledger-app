import { useCallback, useEffect, useRef, useState } from 'react';
import { database } from '@/db';
import type AppSettings from '@/db/models/AppSettings';
import { getSettings, updateSettings, type SettingsPatch } from '@/repositories/settings';

/** How long typing pauses before a field is written. */
const SAVE_AFTER_MS = 400;

/**
 * Shop profile and Payment details save as you type (S11a, S11b): edits are gathered and
 * written shortly after typing stops, and whatever is still waiting is written when the
 * screen closes. Settings stay on this phone only.
 */
export function useSettingsForm() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  // The database hands back the same record, changed in place, so React wouldn't see a new
  // logo or currency without this.
  const [, setVersion] = useState(0);
  const pending = useRef<SettingsPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    setSettings(await getSettings(database));
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length > 0) await updateSettings(database, patch);
  }, []);

  /** Queue a change; it's written once typing pauses. */
  const queue = useCallback(
    (patch: SettingsPatch) => {
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_AFTER_MS);
    },
    [flush],
  );

  /** Write a change now (a picked logo or currency), then show it. */
  const save = useCallback(
    async (patch: SettingsPatch) => {
      pending.current = { ...pending.current, ...patch };
      await flush();
      await reload();
    },
    [flush, reload],
  );

  useEffect(() => () => void flush(), [flush]);

  return { settings, queue, save };
}
