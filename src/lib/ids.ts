import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId';
import { uuidv7 } from 'uuidv7';

/**
 * Device-generated, time-ordered IDs. The data model mandates UUID v7 for every PK
 * so rows created offline keep a stable identity that never needs server remapping
 * (data-model §1, contract §1). We override WatermelonDB's default random-id
 * generator so every record it creates gets a UUID v7.
 */
export function newId(): string {
  return uuidv7();
}

/**
 * LEGACY — do not use for new rows. Deterministic id from a seed string: the same string
 * yields the same id on every device of every user. Builds from 9 July 2026 used it for the
 * starter templates, which made those ids collide across accounts (data model §1b). It is
 * kept only so sync/seedReconcile.ts can recognise and re-key those rows.
 */
export function seededId(seed: string): string {
  // cyrb128 — a compact 128-bit string hash (four 32-bit words).
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const chars = (hex(h1) + hex(h2) + hex(h3) + hex(h4)).split('');
  chars[12] = '7'; // version 7
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16); // variant 10xx
  const h = chars.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

let installed = false;

/** Install the UUID v7 generator into WatermelonDB. Call once at startup. */
export function installIdGenerator(): void {
  if (installed) return;
  setGenerator(newId);
  installed = true;
}
