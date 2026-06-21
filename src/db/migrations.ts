import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

/**
 * Migrations are IMMUTABLE once shipped — never edit a past migration; add a new one
 * and bump SCHEMA_VERSION in schema.ts. v1 is the initial schema, so there are no
 * migrations yet (the list starts empty and grows from version 2 upward).
 */
export const migrations = schemaMigrations({
  migrations: [],
});
