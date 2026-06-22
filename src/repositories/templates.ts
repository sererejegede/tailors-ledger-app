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
  return database.write(() =>
    database.get<Template>(Tables.templates).create((t) => {
      t.name = input.name.trim();
      t.isDefault = input.isDefault ?? false;
    }),
  );
}

export async function updateTemplate(
  database: Database,
  id: string,
  patch: { name?: string },
): Promise<Template> {
  const template = await database.get<Template>(Tables.templates).find(id);
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
