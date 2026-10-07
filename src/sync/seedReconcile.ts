import { Database, Model } from '@nozbe/watermelondb';
import type { DirtyRaw } from '@nozbe/watermelondb/RawRecord';
import { Tables } from '@/db/schema';
import { STARTER_TEMPLATES, type StarterTemplate } from '@/db/seed';
import { newId, seededId } from '@/lib/ids';
import type Template from '@/db/models/Template';
import type TemplateItem from '@/db/models/TemplateItem';
import type MeasurementSet from '@/db/models/MeasurementSet';
import type AppSettings from '@/db/models/AppSettings';

/**
 * Keeps a device's starter templates from leaking into an account (data model §1b).
 *
 * Every install seeds Men's/Women's locally before sign-in. When it joins an account that
 * already has templates, those seed rows are either:
 *  - **discarded** (hard-deleted — the one approved exception to "never hard-delete") when
 *    they never synced, are untouched, and no measurement set references them; or
 *  - **kept** as user data and pushed, demoted from default.
 * Rows from builds that seeded with fixed, cross-account ids (`seededId`) are re-created
 * under fresh ids before they're pushed, because the server rejects those ids with
 * `id_conflict` for every account but the first.
 *
 * `reconcileDefaultTemplate` then keeps exactly one default per account after each pull.
 */

type BookkeepingRaw = DirtyRaw & {
  id: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number | null;
  template_id?: string | null;
};

const rawOf = (record: Model) => record._raw as unknown as BookkeepingRaw;
const isNeverSynced = (record: Model) => record.syncStatus === 'created';
const isSoftDeleted = (record: Model) => rawOf(record).deleted_at != null;
// WatermelonDB stamps created_at and updated_at with one value on create; any edit bumps
// updated_at, so equality means the row was never edited.
const isUnedited = (record: Model) => rawOf(record).updated_at === rawOf(record).created_at;

/** Fixed ids the 9-July-2026 builds gave the starter templates and their items. */
export function legacySeedIds(): Set<string> {
  const ids = new Set<string>();
  for (const starter of STARTER_TEMPLATES) {
    ids.add(seededId(`template:${starter.name}`));
    for (const item of starter.items) {
      ids.add(seededId(`template-item:${starter.name}:${item.key}`));
    }
  }
  return ids;
}

function starterNamed(name: string): StarterTemplate | undefined {
  return STARTER_TEMPLATES.find((starter) => starter.name === name);
}

/** True when `template` is exactly a starter as seeded: never synced, never edited, the
 * same item keys in the same order, nothing added or removed (soft-deleted items count as
 * a removal). */
function isUntouchedStarter(template: Template, items: TemplateItem[]): boolean {
  const starter = starterNamed(template.name);
  if (!starter || !isNeverSynced(template) || !isUnedited(template)) return false;
  if (items.length !== starter.items.length) return false;
  const ordered = [...items].sort((left, right) => left.position - right.position);
  return ordered.every(
    (item, index) =>
      isNeverSynced(item) &&
      isUnedited(item) &&
      !isSoftDeleted(item) &&
      item.key === starter.items[index].key,
  );
}

/** The account's default: the most recently updated non-deleted template flagged default. */
function latestDefault(templates: Template[]): Template | undefined {
  return templates
    .filter((template) => template.isDefault && !isSoftDeleted(template))
    .reduce<Template | undefined>(
      (best, template) =>
        !best || rawOf(template).updated_at > rawOf(best).updated_at ? template : best,
      undefined,
    );
}

function groupItemsByTemplate(items: TemplateItem[]): Map<string, TemplateItem[]> {
  const byTemplate = new Map<string, TemplateItem[]>();
  for (const item of items) {
    const templateId = rawOf(item).template_id;
    if (!templateId) continue;
    const group = byTemplate.get(templateId) ?? [];
    group.push(item);
    byTemplate.set(templateId, group);
  }
  return byTemplate;
}

export type StarterReconcileResult = { discarded: number; rekeyed: number; demoted: number };

/**
 * Run before every push. Discards unused starters on an account that already has
 * templates, demotes kept starters from default there, and re-keys never-synced rows that
 * still carry a legacy fixed id. One write, one batch.
 */
export async function reconcileStarterTemplates(
  database: Database,
): Promise<StarterReconcileResult> {
  const result: StarterReconcileResult = { discarded: 0, rekeyed: 0, demoted: 0 };

  await database.write(async () => {
    const templateCollection = database.get<Template>(Tables.templates);
    const itemCollection = database.get<TemplateItem>(Tables.templateItems);
    const templates = await templateCollection.query().fetch();
    const items = await itemCollection.query().fetch();
    const sets = await database.get<MeasurementSet>(Tables.measurementSets).query().fetch();
    const settings = (await database.get<AppSettings>(Tables.appSettings).query().fetch())[0];

    const accountHasTemplates = templates.some(
      (template) => template.syncStatus === 'synced' && !isSoftDeleted(template),
    );
    const referencedTemplateIds = new Set(
      sets.map((set) => set.templateId).filter((id): id is string => Boolean(id)),
    );
    const itemsByTemplate = groupItemsByTemplate(items);
    const legacyIds = legacySeedIds();

    const ops: Model[] = [];
    const discardedTemplateIds = new Set<string>();
    const discardedItemIds = new Set<string>();

    // 1. Discard untouched, unreferenced starters on an account that already has templates.
    if (accountHasTemplates) {
      for (const template of templates) {
        if (isSoftDeleted(template) || referencedTemplateIds.has(template.id)) continue;
        const templateItems = itemsByTemplate.get(template.id) ?? [];
        if (!isUntouchedStarter(template, templateItems)) continue;
        ops.push(template.prepareDestroyPermanently());
        discardedTemplateIds.add(template.id);
        for (const item of templateItems) {
          ops.push(item.prepareDestroyPermanently());
          discardedItemIds.add(item.id);
        }
        result.discarded += 1;
      }
    }

    // 2. Kept, never-synced starters must not claim the default on an existing account.
    const demoteTemplateIds = new Set<string>();
    if (accountHasTemplates) {
      for (const template of templates) {
        if (discardedTemplateIds.has(template.id) || isSoftDeleted(template)) continue;
        if (isNeverSynced(template) && starterNamed(template.name) && template.isDefault) {
          demoteTemplateIds.add(template.id);
        }
      }
    }

    // 3. Re-key never-synced rows still carrying a legacy fixed id. Each record is touched
    //    by at most one prepared op (WatermelonDB forbids two in one batch), so the demotion
    //    is folded into the re-created row's raw where both apply.
    const templateIdRemap = new Map<string, string>();
    for (const template of templates) {
      if (discardedTemplateIds.has(template.id)) continue;
      if (!isNeverSynced(template) || !legacyIds.has(template.id)) continue;
      const nextId = newId();
      const nextRaw: BookkeepingRaw = { ...rawOf(template), id: nextId, _status: 'created', _changed: '' };
      if (demoteTemplateIds.delete(template.id)) {
        nextRaw.is_default = false;
        result.demoted += 1;
      }
      ops.push(templateCollection.prepareCreateFromDirtyRaw(nextRaw));
      ops.push(template.prepareDestroyPermanently());
      templateIdRemap.set(template.id, nextId);
      result.rekeyed += 1;
    }

    for (const template of templates) {
      if (!demoteTemplateIds.has(template.id)) continue;
      ops.push(
        template.prepareUpdate((record) => {
          record.isDefault = false;
        }),
      );
      result.demoted += 1;
    }

    for (const item of items) {
      if (discardedItemIds.has(item.id)) continue;
      const parentId = rawOf(item).template_id ?? '';
      const nextParentId = templateIdRemap.get(parentId);
      const legacyItem = isNeverSynced(item) && legacyIds.has(item.id);
      if (legacyItem) {
        ops.push(
          itemCollection.prepareCreateFromDirtyRaw({
            ...rawOf(item),
            id: newId(),
            template_id: nextParentId ?? parentId,
            _status: 'created',
            _changed: '',
          }),
        );
        ops.push(item.prepareDestroyPermanently());
        result.rekeyed += 1;
      } else if (nextParentId) {
        // `template` is an immutable relation, so set the column through _setRaw, which
        // keeps WatermelonDB's change tracking intact.
        ops.push(
          item.prepareUpdate((record) => {
            record._setRaw('template_id', nextParentId);
          }),
        );
      }
    }

    for (const set of sets) {
      const nextTemplateId = set.templateId ? templateIdRemap.get(set.templateId) : undefined;
      if (!nextTemplateId) continue;
      ops.push(
        set.prepareUpdate((record) => {
          record.templateId = nextTemplateId;
        }),
      );
    }

    // 4. Never leave the settings default pointing at a row that no longer exists — a
    //    failed push could otherwise strand it until the next successful sync.
    const pointer = settings?.defaultTemplateId;
    if (settings && pointer && (discardedTemplateIds.has(pointer) || templateIdRemap.has(pointer))) {
      // Candidates exclude rows this batch removes, replaces or demotes; the in-memory
      // models don't reflect the prepared ops yet.
      const candidates = templates.filter(
        (template) =>
          !discardedTemplateIds.has(template.id) &&
          !templateIdRemap.has(template.id) &&
          !demoteTemplateIds.has(template.id),
      );
      const replacement = templateIdRemap.get(pointer) ?? latestDefault(candidates)?.id;
      ops.push(
        settings.prepareUpdate((record) => {
          record.defaultTemplateId = replacement;
        }),
      );
    }

    if (ops.length) await database.batch(ops);
  });

  return result;
}

/**
 * Run after the final pull. Exactly one default per account: if several non-deleted
 * templates are flagged, the most recently updated wins and the rest are demoted (normal
 * edits, so they sync). The settings pointer follows the winner, or is cleared if it
 * dangles and there is no default at all.
 */
export async function reconcileDefaultTemplate(database: Database): Promise<{ demoted: number }> {
  let demoted = 0;

  await database.write(async () => {
    const templates = await database.get<Template>(Tables.templates).query().fetch();
    const settings = (await database.get<AppSettings>(Tables.appSettings).query().fetch())[0];
    const live = templates.filter((template) => !isSoftDeleted(template));
    const winner = latestDefault(live);

    const ops: Model[] = [];
    for (const template of live) {
      if (!template.isDefault || template.id === winner?.id) continue;
      ops.push(
        template.prepareUpdate((record) => {
          record.isDefault = false;
        }),
      );
      demoted += 1;
    }

    if (settings) {
      const pointer = settings.defaultTemplateId;
      const pointerIsLive = live.some((template) => template.id === pointer);
      const target = winner?.id ?? (pointerIsLive ? pointer : undefined);
      if (target !== pointer) {
        ops.push(
          settings.prepareUpdate((record) => {
            record.defaultTemplateId = target;
          }),
        );
      }
    }

    if (ops.length) await database.batch(ops);
  });

  return { demoted };
}
