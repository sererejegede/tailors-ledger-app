import { Database } from '@nozbe/watermelondb';
import { Tables } from '@/db/schema';
import { ensureSeeded, STARTER_TEMPLATES } from '@/db/seed';
import { seededId } from '@/lib/ids';
import { updateSettings } from '@/repositories/settings';
import type Template from '@/db/models/Template';
import type TemplateItem from '@/db/models/TemplateItem';
import { applyServerChanges, normalizeEnvelope } from '../mapper';

/** Seed the way the 9-July-2026 builds did: starter templates under fixed ids that are
 * identical for every user (data model §1b). */
export async function seedWithLegacyIds(db: Database): Promise<void> {
  await db.write(async () => {
    for (const starter of STARTER_TEMPLATES) {
      const template = await db.get<Template>(Tables.templates).create((record) => {
        record._raw.id = seededId(`template:${starter.name}`);
        record.name = starter.name;
        record.isDefault = starter.isDefault;
      });
      for (const [position, item] of starter.items.entries()) {
        await db.get<TemplateItem>(Tables.templateItems).create((record) => {
          record._raw.id = seededId(`template-item:${starter.name}:${item.key}`);
          record.template!.id = template.id;
          record.key = item.key;
          record.position = position;
          record.unit = 'in';
          record.minRange = item.min;
          record.maxRange = item.max;
        });
      }
    }
  });
  await ensureSeeded(db); // templates exist, so this only creates the settings row
  await updateSettings(db, { defaultTemplateId: seededId("template:Men's") });
}

export type AccountTemplate = { id: string; name: string; isDefault: boolean; updatedAt: number };

/** Server-side template row, as another device on the account wrote it. */
export function accountTemplateRow(template: AccountTemplate) {
  return {
    id: template.id,
    name: template.name,
    is_default: template.isDefault,
    created_at: template.updatedAt - 1000,
    updated_at: template.updatedAt,
    deleted_at: null,
  };
}

/** Put account templates on the device as already-pulled (`synced`) rows. */
export async function addPulledTemplates(db: Database, templates: AccountTemplate[]): Promise<void> {
  await applyServerChanges(
    db,
    normalizeEnvelope({
      templates: { created: templates.map(accountTemplateRow), updated: [], deleted: [] },
    }),
  );
}
