import { Database } from '@nozbe/watermelondb';
import { Tables } from './schema';
import { seededId } from '@/lib/ids';
import type Template from './models/Template';
import type TemplateItem from './models/TemplateItem';
import type AppSettings from './models/AppSettings';

/**
 * Starter content so a tailor isn't staring at an empty app on first run (spec §10).
 * Templates are general-purpose; the natural divergence is sex (e.g. Women's carries
 * bust), so we ship an editable Men's (default) + Women's. Item lists and typical
 * ranges are taken verbatim from docs/tailor-app-wireframe.html (TEMPLATES).
 *
 * Seed rows get DETERMINISTIC ids (seededId), so two devices on one account converge on the
 * same "Men's"/"Women's" (and item) ids and merge by id on sync rather than duplicating.
 */

export type StarterItem = { key: string; min?: number; max?: number };
export type StarterTemplate = { name: string; isDefault: boolean; items: StarterItem[] };

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Men's",
    isDefault: true,
    items: [
      { key: 'Back', min: 20, max: 24 },
      { key: 'Back to Sleeve', min: 24, max: 28 },
      { key: 'Sleeve (Short)', min: 14, max: 18 },
      { key: 'Sleeve (Long)', min: 21, max: 25 },
      { key: 'Neck', min: 15, max: 19 },
      { key: 'Cap', min: 21, max: 25 },
      { key: 'Length', min: 40, max: 60 },
      { key: 'Trouser length', min: 37, max: 41 },
      { key: 'Wrist', min: 6, max: 12 },
      { key: 'Thigh', min: 18, max: 34 },
    ],
  },
  {
    name: "Women's",
    isDefault: false,
    items: [
      { key: 'Shoulder', min: 13, max: 20 },
      { key: 'Back width', min: 13, max: 18 },
      { key: 'Back waist length', min: 12, max: 16 },
      { key: 'Chest width', min: 15, max: 19 },
      { key: 'Bust', min: 33, max: 45 },
      { key: 'Waist', min: 28, max: 38 },
      { key: 'Hip', min: 32, max: 45 },
      { key: 'Armhole', min: 20, max: 30 },
      { key: 'Bicep', min: 8, max: 14 },
      { key: 'Elbow', min: 8, max: 14 },
      { key: 'Wrist', min: 5, max: 9 },
      { key: 'Sleeve length', min: 6, max: 26 },
      { key: 'Bust span', min: 5, max: 10 },
      { key: 'Shoulder - bust point', min: 5, max: 10 },
      { key: 'Full length', min: 50, max: 70 },
      { key: 'Knee length', min: 30, max: 45 },
      { key: 'Thigh', min: 18, max: 34 },
      { key: 'Trouser length', min: 37, max: 45 },
    ],
  },
];

const DEFAULT_UNIT = 'in';

/**
 * Seed starter templates + the single app_settings row, exactly once. Idempotent:
 * re-running is a no-op once templates/settings exist, so it's safe to call on every
 * launch. Returns true if it actually seeded.
 */
export async function ensureSeeded(database: Database): Promise<boolean> {
  const templates = database.get<Template>(Tables.templates);
  const settings = database.get<AppSettings>(Tables.appSettings);

  const existingTemplates = await templates.query().fetchCount();
  const existingSettings = await settings.query().fetchCount();
  if (existingTemplates > 0 && existingSettings > 0) return false;

  await database.write(async () => {
    let defaultTemplateId: string | undefined;

    if (existingTemplates === 0) {
      const templateItems = database.get<TemplateItem>(Tables.templateItems);
      for (const starter of STARTER_TEMPLATES) {
        // Deterministic ids (same on every device) so multi-device accounts merge the
        // starter templates + items by id instead of duplicating them (see seededId).
        const created = await templates.create((t) => {
          t._raw.id = seededId(`template:${starter.name}`);
          t.name = starter.name;
          t.isDefault = starter.isDefault;
        });
        if (starter.isDefault) defaultTemplateId = created.id;

        await Promise.all(
          starter.items.map((item, position) =>
            templateItems.create((ti) => {
              ti._raw.id = seededId(`template-item:${starter.name}:${item.key}`);
              ti.template!.id = created.id;
              ti.key = item.key;
              ti.position = position;
              ti.unit = DEFAULT_UNIT;
              ti.minRange = item.min;
              ti.maxRange = item.max;
            }),
          ),
        );
      }
    }

    if (existingSettings === 0) {
      await settings.create((s) => {
        s.units = DEFAULT_UNIT;
        s.fractionGranularity = 'quarters';
        s.defaultTemplateId = defaultTemplateId;
        s.appLockEnabled = false;
        s.textSize = 'normal';
        s.highContrast = false;
        s.rangeWarningsEnabled = true;
      });
    }
  });

  return true;
}
