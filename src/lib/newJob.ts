import type { NewJobItem } from '@/repositories/jobs';
import { bufferToMinor } from './amountEntry';

/**
 * The New job screen (S8) in memory. Nothing is written until Create job (lazy create,
 * data-model §1a). Each line is a name and an optional price: new items get quantity 1 and
 * no link to a measurement set (docs/ux-redesign-plan.md, technical notes).
 */
export type DraftLine = {
  key: string;
  name: string;
  /** The money pad's buffer, in whole naira; empty while unpriced. */
  price: string;
};

/** The total so far. An unpriced line counts as 0, as on a saved job. */
export function draftTotalMinor(lines: DraftLine[]): number {
  return lines.reduce((sum, l) => sum + bufferToMinor(l.price), 0);
}

/** Whether the tailor has typed anything, so leaving should ask first. */
export function draftEntered(lines: DraftLine[], title: string, collectOn: number | null): boolean {
  return lines.some((l) => l.name.trim() || l.price) || title.trim() !== '' || collectOn != null;
}

/**
 * The items to create, or why the job can't be created yet. A line with neither name nor
 * price is an empty row and is skipped; a priced line needs a name, so its money isn't lost.
 */
export function draftToItems(lines: DraftLine[]): { items: NewJobItem[] } | { error: string } {
  const used = lines.filter((l) => l.name.trim() || l.price);
  if (used.some((l) => !l.name.trim())) return { error: 'Give each priced item a name.' };
  if (!used.length) return { error: 'Add at least one item.' };
  return {
    items: used.map((l) => ({
      description: l.name.trim(),
      quantity: 1,
      unitPriceMinor: l.price ? bufferToMinor(l.price) : null,
      setId: null,
    })),
  };
}
