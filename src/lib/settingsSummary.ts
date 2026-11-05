import { formatReceiptNumber } from './money';

/**
 * What the Settings rows say (S11, S11a, S11b): the backup card, the one-line summaries
 * next to Shop profile, Payment details, Templates and Fraction steps, and the check on
 * the next receipt number. Pure, so they're tested without the screens.
 */

export type BackupTone = 'ok' | 'warn' | 'off';
export type BackupStatus = { tone: BackupTone; title: string; detail: string };

export type BackupInput = {
  /** Sync is set up on this build. */
  configured: boolean;
  /** The signed-in account's email, or null when signed out. */
  email: string | null;
  syncing: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
  /** Rows the server turned down. */
  rejected: number;
  /** Another account's changes still on the phone pause sync (data model §1c). */
  blocked: boolean;
};

/**
 * The backup card's dot, line and sub-line. Green once a backup has gone through and
 * nothing is stuck; amber when signed in but something is wrong; grey when there's no
 * backup at all. `ago` turns a time into "2 minutes ago".
 */
export function backupStatus(input: BackupInput, ago: (time: number) => string): BackupStatus {
  if (!input.configured) {
    return { tone: 'off', title: 'Saved on this phone', detail: 'Backup isn’t set up on this version' };
  }
  if (!input.email) {
    return { tone: 'off', title: 'Not backed up', detail: 'Sign in to back up your data' };
  }
  const email = input.email;
  if (input.syncing) return { tone: 'ok', title: 'Backing up…', detail: email };
  if (input.blocked) return { tone: 'warn', title: 'Backup paused', detail: email };
  if (input.lastError) return { tone: 'warn', title: 'Backup failed', detail: email };
  if (!input.lastSyncedAt) return { tone: 'warn', title: 'Not backed up yet', detail: email };
  const title = `Backed up ${ago(input.lastSyncedAt)}`;
  return { tone: input.rejected > 0 ? 'warn' : 'ok', title, detail: email };
}

/** Next to "Payment details": "GTBank ··· 6789", or what's missing. */
export function paymentSummary(bankName?: string | null, accountNumber?: string | null): string {
  const bank = bankName?.trim() ?? '';
  const digits = accountNumber?.trim() ?? '';
  const tail = digits ? `··· ${digits.slice(-4)}` : '';
  if (bank && tail) return `${bank} ${tail}`;
  return bank || tail || 'Not set';
}

/** Next to "Shop profile": the shop's name, or what the screen holds. */
export function shopSummary(shopName?: string | null): string {
  return shopName?.trim() || 'Name, logo, receipts';
}

/** Next to "Templates": "3 · Men's is default". */
export function templatesSummary(templates: { name: string; isDefault: boolean }[]): string {
  if (templates.length === 0) return 'None yet';
  const chosen = templates.find((t) => t.isDefault);
  return chosen ? `${templates.length} · ${chosen.name} is default` : String(templates.length);
}

export const FRACTION_STEPS = [
  { id: 'quarters', name: '¼' },
  { id: 'eighths', name: '⅛' },
];

/** Next to "Fraction steps": "¼" or "⅛". */
export function fractionLabel(granularity?: string | null): string {
  return FRACTION_STEPS.find((f) => f.id === granularity)?.name ?? '¼';
}

/**
 * The typed next receipt number. It can be raised to carry on from a paper receipt book,
 * never lowered below the number the next receipt would get anyway (`min`), so a number
 * is never reused.
 */
export function parseNextReceiptNumber(
  text: string,
  min: number,
): { ok: true; value: number } | { ok: false; error: string } {
  const digits = text.trim();
  const value = Number(digits);
  if (!/^\d+$/.test(digits) || value < 1) return { ok: false, error: 'Enter a whole number.' };
  if (value < min) return { ok: false, error: `It can’t go below ${formatReceiptNumber(min)}.` };
  return { ok: true, value };
}
