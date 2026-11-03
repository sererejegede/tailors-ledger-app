import { addColumns, createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

/**
 * Migrations are IMMUTABLE once shipped — never edit a past migration; add a new one
 * and bump SCHEMA_VERSION in schema.ts. Column lists are written out literally here, not
 * shared with schema.ts, because a shipped migration must not change when the schema does.
 */
export const migrations = schemaMigrations({
  migrations: [
    {
      // Jobs, job items, payments (receipts) + the shop profile (data-model §3).
      toVersion: 2,
      steps: [
        createTable({
          name: 'jobs',
          columns: [
            { name: 'client_id', type: 'string', isIndexed: true },
            { name: 'title', type: 'string', isOptional: true },
            { name: 'currency', type: 'string' },
            { name: 'collect_on', type: 'number', isOptional: true },
            { name: 'note', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
        createTable({
          name: 'job_items',
          columns: [
            { name: 'job_id', type: 'string', isIndexed: true },
            { name: 'description', type: 'string' },
            { name: 'quantity', type: 'number' },
            { name: 'unit_price_minor', type: 'number', isOptional: true },
            { name: 'set_id', type: 'string', isOptional: true },
            { name: 'position', type: 'number' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
        createTable({
          name: 'payments',
          columns: [
            { name: 'job_id', type: 'string', isIndexed: true },
            { name: 'receipt_number', type: 'number' },
            { name: 'amount_minor', type: 'number' },
            { name: 'paid_at', type: 'number' },
            { name: 'receipt_json', type: 'string' },
            { name: 'voided_at', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'app_settings',
          columns: [
            { name: 'shop_phone', type: 'string', isOptional: true },
            { name: 'shop_address', type: 'string', isOptional: true },
            { name: 'receipt_footer', type: 'string', isOptional: true },
            { name: 'currency', type: 'string', isOptional: true },
            { name: 'next_receipt_number', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      // Payment details for invoices (data-model §3, app_settings).
      toVersion: 3,
      steps: [
        addColumns({
          table: 'app_settings',
          columns: [
            { name: 'bank_name', type: 'string', isOptional: true },
            { name: 'bank_account_name', type: 'string', isOptional: true },
            { name: 'bank_account_number', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
