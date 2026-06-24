import { Database, Q } from '@nozbe/watermelondb';
import { Tables } from '@/db/schema';
import Template from '@/db/models/Template';
import TemplateItem from '@/db/models/TemplateItem';
import AppSettings from '@/db/models/AppSettings';
import { notDeleted, softDeleteById } from './softDelete';

/**
 * Template repository. Templates are reusable, ordered lists of measurement keys with
 * an optional expected range per item (spec §3). Exactly one template is the default
 * (data-model §3); new sets seed from it.
 */

export type NewTemplate = { name: string; isDefault?: boolean };
export type NewTemplateItem = {
  key: string;
  unit?: string;
  minRange?: number;
  maxRange?: number;
  position?: number;
};
export type TemplateItemPatch = Partial<{
  key: string;
  unit: string;
  minRange: number;
  maxRange: number;
  position: number;
}>;

const DEFAULT_UNIT = 'in';

/** Thrown when a non-blank template name collides with an existing (non-deleted) template. */
export class DuplicateTemplateNameError extends Error {
  constructor(public readonly templateName: string) {
    super(`A template named "${templateName}" already exists.`);
    this.name = 'DuplicateTemplateNameError';
  }
}

/**
 * Enforce unique template names, case-insensitive and trimmed, among non-deleted templates
 * (repo-enforced — WatermelonDB has no unique constraints). Pass `excludeId` when renaming
 * so a template doesn't clash with itself. Throws `DuplicateTemplateNameError`.
 */
export async function assertTemplateNameAvailable(
  database: Database,
  name: string,
  excludeId?: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const target = trimmed.toLowerCase();
  const existing = await database.get<Template>(Tables.templates).query(notDeleted).fetch();
  const clash = existing.some(
    (t) => t.id !== excludeId && t.name.trim().toLowerCase() === target,
  );
  if (clash) throw new DuplicateTemplateNameError(trimmed);
}

export async function listTemplates(database: Database): Promise<Template[]> {
  return database
    .get<Template>(Tables.templates)
    .query(notDeleted, Q.sortBy('name', Q.asc))
    .fetch();
}

/**
 * The template new measurements should seed from: the settings' default_template_id if
 * set, else the `is_default` template, else the first available. Throws if there are none.
 */
export async function getDefaultTemplateId(database: Database): Promise<string> {
  const settings = await database.get<AppSettings>(Tables.appSettings).query().fetch();
  const fromSettings = settings[0]?.defaultTemplateId;
  if (fromSettings) return fromSettings;
  const templates = await listTemplates(database);
  const fallback = templates.find((t) => t.isDefault) ?? templates[0];
  if (!fallback) throw new Error('No template available — seed the database first.');
  return fallback.id;
}

/** Items of a template in their habitual order, excluding tombstones. */
export async function templateItems(
  database: Database,
  templateId: string,
): Promise<TemplateItem[]> {
  return database
    .get<TemplateItem>(Tables.templateItems)
    .query(Q.where('template_id', templateId), notDeleted, Q.sortBy('position', Q.asc))
    .fetch();
}

export async function createTemplate(
  database: Database,
  input: NewTemplate,
): Promise<Template> {
  const name = input.name.trim();
  await assertTemplateNameAvailable(database, name);
  return database.write(() =>
    database.get<Template>(Tables.templates).create((t) => {
      t.name = name;
      t.isDefault = input.isDefault ?? false;
    }),
  );
}

/**
 * Lazy create for a brand-new template: write the template and its items together, only
 * once it has a real name and at least one item (the editor holds both in memory until
 * then). Mirrors the measurement-set lazy create — backing out of the editor leaves no
 * empty "New template" rows behind. Throws `DuplicateTemplateNameError` on a name clash.
 */
export type NewTemplateWithItems = {
  name: string;
  isDefault?: boolean;
  items: Array<{ key: string; unit?: string; minRange?: number; maxRange?: number }>;
};

export async function createTemplateWithItems(
  database: Database,
  input: NewTemplateWithItems,
): Promise<Template> {
  const name = input.name.trim();
  await assertTemplateNameAvailable(database, name);
  return database.write(async () => {
    const template = await database.get<Template>(Tables.templates).create((t) => {
      t.name = name;
      t.isDefault = input.isDefault ?? false;
    });
    const col = database.get<TemplateItem>(Tables.templateItems);
    await Promise.all(
      input.items.map((it, position) =>
        col.create((ti) => {
          ti.template!.id = template.id;
          ti.key = it.key.trim();
          ti.position = position;
          ti.unit = it.unit ?? DEFAULT_UNIT;
          ti.minRange = it.minRange;
          ti.maxRange = it.maxRange;
        }),
      ),
    );
    return template;
  });
}

export async function updateTemplate(
  database: Database,
  id: string,
  patch: { name?: string },
): Promise<Template> {
  const template = await database.get<Template>(Tables.templates).find(id);
  if (patch.name !== undefined) await assertTemplateNameAvailable(database, patch.name, id);
  await database.write(async () => {
    await template.update((t) => {
      if (patch.name !== undefined) t.name = patch.name.trim();
    });
  });
  return template;
}

/** Make `id` the sole default template (clears the flag on every other template). */
export async function setDefaultTemplate(database: Database, id: string): Promise<void> {
  const collection = database.get<Template>(Tables.templates);
  const all = await collection.query(notDeleted).fetch();
  await database.write(async () => {
    await Promise.all(
      all.map((t) =>
        t.isDefault !== (t.id === id)
          ? t.update((m) => {
              m.isDefault = t.id === id;
            })
          : Promise.resolve(),
      ),
    );
  });
}

export async function addTemplateItem(
  database: Database,
  templateId: string,
  input: NewTemplateItem,
): Promise<TemplateItem> {
  const existing = await templateItems(database, templateId);
  const position =
    input.position ?? (existing.length ? existing[existing.length - 1].position + 1 : 0);
  return database.write(() =>
    database.get<TemplateItem>(Tables.templateItems).create((ti) => {
      ti.template!.id = templateId;
      ti.key = input.key.trim();
      ti.position = position;
      ti.unit = input.unit ?? DEFAULT_UNIT;
      ti.minRange = input.minRange;
      ti.maxRange = input.maxRange;
    }),
  );
}

export async function updateTemplateItem(
  database: Database,
  id: string,
  patch: TemplateItemPatch,
): Promise<TemplateItem> {
  const item = await database.get<TemplateItem>(Tables.templateItems).find(id);
  await database.write(async () => {
    await item.update((ti) => {
      if (patch.key !== undefined) ti.key = patch.key.trim();
      if (patch.unit !== undefined) ti.unit = patch.unit;
      if (patch.minRange !== undefined) ti.minRange = patch.minRange;
      if (patch.maxRange !== undefined) ti.maxRange = patch.maxRange;
      if (patch.position !== undefined) ti.position = patch.position;
    });
  });
  return item;
}

/** Reorder a template's items to match `orderedIds` (drag-reorder in the editor). */
export async function reorderTemplateItems(
  database: Database,
  orderedIds: string[],
): Promise<void> {
  const collection = database.get<TemplateItem>(Tables.templateItems);
  const items = await Promise.all(orderedIds.map((id) => collection.find(id)));
  await database.write(async () => {
    await Promise.all(
      items.map((item, position) =>
        item.position !== position
          ? item.update((ti) => {
              ti.position = position;
            })
          : Promise.resolve(),
      ),
    );
  });
}

export async function softDeleteTemplate(database: Database, id: string): Promise<void> {
  await softDeleteById<Template>(database, Tables.templates, id);
}

export async function softDeleteTemplateItem(database: Database, id: string): Promise<void> {
  await softDeleteById<TemplateItem>(database, Tables.templateItems, id);
}
