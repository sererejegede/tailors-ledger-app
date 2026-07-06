/* eslint-disable no-console */
// One-off device-DB forensic check. Run: node --experimental-sqlite scripts/inspect-device-db.cjs <db-path>
const { DatabaseSync } = require('node:sqlite');

const path = process.argv[2] || '/tmp/tldb/tailors_ledger.db';
const db = new DatabaseSync(path);

const q = (sql, ...args) => db.prepare(sql).all(...args);
const one = (sql, ...args) => db.prepare(sql).get(...args);

const SYNC_TABLES = [
  'clients', 'templates', 'template_items',
  'measurement_sets', 'measurement_items', 'measurement_values', 'images',
];

// child -> { parent, fk } (matches src/sync/types.ts PARENT_EDGES)
const EDGES = [
  ['template_items', 'templates', 'template_id'],
  ['measurement_sets', 'clients', 'client_id'],
  ['measurement_sets', 'templates', 'template_id'],
  ['measurement_items', 'measurement_sets', 'set_id'],
  ['measurement_values', 'measurement_items', 'item_id'],
  ['images', 'measurement_sets', 'set_id'],
];

console.log('=== Row counts (total / pending[_status!=synced] / soft-deleted) ===');
for (const t of SYNC_TABLES) {
  const hasDeleted = q(`PRAGMA table_info(${t})`).some((c) => c.name === 'deleted_at');
  const total = one(`SELECT COUNT(*) n FROM ${t}`).n;
  const pending = one(`SELECT COUNT(*) n FROM ${t} WHERE _status != 'synced'`).n;
  const deleted = hasDeleted
    ? one(`SELECT COUNT(*) n FROM ${t} WHERE deleted_at IS NOT NULL`).n
    : 0;
  console.log(`  ${t.padEnd(20)} total=${total}  pending=${pending}  soft-deleted=${deleted}`);
}

console.log('\n=== _status breakdown per table ===');
for (const t of SYNC_TABLES) {
  const rows = q(`SELECT _status, COUNT(*) n FROM ${t} GROUP BY _status`);
  console.log(`  ${t.padEnd(20)} ${rows.map((r) => `${r._status}=${r.n}`).join('  ')}`);
}

console.log('\n=== Orphan checks (child rows whose parent id is missing from the parent table) ===');
for (const [child, parent, fk] of EDGES) {
  const nullable = child === 'measurement_sets' && fk === 'template_id';
  const fkFilter = `c.${fk} IS NOT NULL`;
  // parent row entirely absent
  const missing = one(
    `SELECT COUNT(*) n FROM ${child} c
     WHERE ${fkFilter} AND NOT EXISTS (SELECT 1 FROM ${parent} p WHERE p.id = c.${fk})`,
  ).n;
  // among those, how many are PENDING (i.e. would be pushed and rejected)
  const missingPending = one(
    `SELECT COUNT(*) n FROM ${child} c
     WHERE ${fkFilter} AND c._status != 'synced'
       AND NOT EXISTS (SELECT 1 FROM ${parent} p WHERE p.id = c.${fk})`,
  ).n;
  // parent exists but is soft-deleted locally
  const parentDeleted = q(`PRAGMA table_info(${parent})`).some((x) => x.name === 'deleted_at')
    ? one(
        `SELECT COUNT(*) n FROM ${child} c
         JOIN ${parent} p ON p.id = c.${fk}
         WHERE ${fkFilter} AND p.deleted_at IS NOT NULL AND c._status != 'synced'`,
      ).n
    : 0;
  const tag = nullable ? ' (nullable FK)' : '';
  console.log(
    `  ${child} -> ${parent} via ${fk}${tag}: missing-parent=${missing} (pending=${missingPending})  parent-soft-deleted&childPending=${parentDeleted}`,
  );
}

console.log('\n=== Sample orphaned PENDING rows (up to 5 per edge) ===');
for (const [child, parent, fk] of EDGES) {
  const rows = q(
    `SELECT c.id, c.${fk} AS parent_id, c._status FROM ${child} c
     WHERE c.${fk} IS NOT NULL AND c._status != 'synced'
       AND NOT EXISTS (SELECT 1 FROM ${parent} p WHERE p.id = c.${fk}) LIMIT 5`,
  );
  if (rows.length) {
    console.log(`  ${child} -> ${parent}:`);
    for (const r of rows) console.log(`     id=${r.id}  ${fk}=${r.parent_id}  _status=${r._status}`);
  }
}

console.log('\n=== Empty measurement_items (no current_value) — the "empty measurements" cleanup suspect ===');
const emptyItems = one(`SELECT COUNT(*) n FROM measurement_items WHERE current_value IS NULL`).n;
const emptyPending = one(
  `SELECT COUNT(*) n FROM measurement_items WHERE current_value IS NULL AND _status != 'synced'`,
).n;
const setsNoItems = one(
  `SELECT COUNT(*) n FROM measurement_sets s
   WHERE NOT EXISTS (SELECT 1 FROM measurement_items i WHERE i.set_id = s.id)`,
).n;
console.log(`  empty items=${emptyItems} (pending=${emptyPending});  sets with zero items=${setsNoItems}`);

db.close();
