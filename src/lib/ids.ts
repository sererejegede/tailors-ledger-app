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

let installed = false;

/** Install the UUID v7 generator into WatermelonDB. Call once at startup. */
export function installIdGenerator(): void {
  if (installed) return;
  setGenerator(newId);
  installed = true;
}
