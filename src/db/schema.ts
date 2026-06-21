import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * On-device SQLite schema. Mirrors docs/tailor-app-data-model.md §3 exactly.
 *
 * Conventions:
 * - Every PK `id` is a device-generated UUID v7 (see src/lib/ids.ts); WatermelonDB
 *   stores it as the row id.
 * - `created_at` / `updated_at` are WatermelonDB-managed (declared so the engine
 *   auto-stamps them); `updated_at` drives last-write-wins.
 * - `deleted_at` is our tombstone column (set on soft delete; never hard-delete).
 * - Local dirty-tracking uses WatermelonDB's built-in `_status` / `_changed`, so we
 *   do NOT add a redundant `sync_status` column (it never crosses the wire — contract §11).
 * - `measurement_values` is append-only: no `updated_at`, no `deleted_at`.
 * - Migrations are immutable once shipped; bump SCHEMA_VERSION and add a migration.
 */

export const SCHEMA_VERSION = 1;

export const Tables = {
  clients: 'clients',
  templates: 'templates',
  templateItems: 'template_items',
  measurementSets: 'measurement_sets',
  measurementItems: 'measurement_items',
  measurementValues: 'measurement_values',
  images: 'images',
  appSettings: 'app_settings',
} as const;

export const schema = appSchema({
  version: SCHEMA_VERSION,
  tables: [
    tableSchema({
      name: Tables.clients,
      columns: [
        { name: 'name', type: 'string' },
        { name: 'phone', type: 'string', isOptional: true, isIndexed: true },
        { name: 'comment', type: 'string', isOptional: true },
        { name: 'photo_local_uri', type: 'string', isOptional: true },
        { name: 'photo_remote_url', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: Tables.templates,
      columns: [
        { name: 'name', type: 'string' },
        { name: 'is_default', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: Tables.templateItems,
      columns: [
        { name: 'template_id', type: 'string', isIndexed: true },
        { name: 'key', type: 'string' },
        { name: 'position', type: 'number' },
        { name: 'unit', type: 'string' },
        { name: 'min_range', type: 'number', isOptional: true },
        { name: 'max_range', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: Tables.measurementSets,
      columns: [
        { name: 'client_id', type: 'string', isIndexed: true },
        { name: 'template_id', type: 'string', isOptional: true },
        { name: 'template_name_snapshot', type: 'string', isOptional: true },
        { name: 'label', type: 'string', isOptional: true },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true, isIndexed: true },
      ],
    }),

    tableSchema({
      name: Tables.measurementItems,
      columns: [
        { name: 'set_id', type: 'string', isIndexed: true },
        { name: 'key', type: 'string' },
        { name: 'position', type: 'number' },
        { name: 'unit', type: 'string' },
        { name: 'current_value', type: 'number', isOptional: true },
        { name: 'current_value_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // Append-only history table — never updated, never deleted (data-model §3, §4).
    tableSchema({
      name: Tables.measurementValues,
      columns: [
        { name: 'item_id', type: 'string', isIndexed: true },
        { name: 'value', type: 'number' },
        { name: 'recorded_at', type: 'number', isIndexed: true },
        { name: 'source', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: Tables.images,
      columns: [
        { name: 'set_id', type: 'string', isIndexed: true },
        { name: 'kind', type: 'string' },
        { name: 'local_uri', type: 'string' },
        { name: 'remote_url', type: 'string', isOptional: true },
        { name: 'upload_status', type: 'string', isIndexed: true },
        { name: 'width', type: 'number', isOptional: true },
        { name: 'height', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    // Single local row. Mostly device-local (contract §11); cursor/last-sync live here too.
    tableSchema({
      name: Tables.appSettings,
      columns: [
        { name: 'units', type: 'string' },
        { name: 'fraction_granularity', type: 'string' }, // 'quarters' | 'eighths'
        { name: 'default_template_id', type: 'string', isOptional: true },
        { name: 'shop_name', type: 'string', isOptional: true },
        { name: 'logo_uri', type: 'string', isOptional: true },
        { name: 'app_lock_enabled', type: 'boolean' },
        { name: 'text_size', type: 'string' }, // 'normal' | 'large'
        { name: 'high_contrast', type: 'boolean' },
        { name: 'range_warnings_enabled', type: 'boolean' },
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'sync_cursor', type: 'string', isOptional: true }, // opaque sync cursor (Phase 4)
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
