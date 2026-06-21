import { Database } from '@nozbe/watermelondb';
import { Tables } from './schema';
import type Template from './models/Template';
import type TemplateItem from './models/TemplateItem';
import type AppSettings from './models/AppSettings';

/**
 * Starter content so a tailor isn't staring at an empty app on first run (spec §10).
 * Templates are general-purpose; the natural divergence is sex (e.g. Women's carries
 * bust), so we ship an editable Men's (default) + Women's. Item lists and typical
 * ranges are taken verbatim from docs/tailor-app-wireframe.html (TEMPLATES).
 */

export type StarterItem = { key: string; min?: number; max?: number };
export type StarterTemplate = { name: string; isDefault: boolean; items: StarterItem[] };

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Men's",
    isDefault: true,
    items: [
      { key: 'Neck', min: 13, max: 20 },
      { key: 'Shoulder', min: 15, max: 24 },
      { key: 'Chest', min: 32, max: 56 },
      { key: 'Stomach', min: 28, max: 54 },
      { key: 'Top length', min: 24, max: 34 },
      { key: 'Sleeve length', min: 8, max: 28 },
      { key: 'Round sleeve', min: 12, max: 24 },
      { key: 'Wrist', min: 6, max: 12 },
      { key: 'Trouser length', min: 34, max: 46 },
      { key: 'Waist', min: 28, max: 48 },
      { key: 'Thigh', min: 18, max: 34 },
      { key: 'Base', min: 11, max: 20 },
    ],
  },
  {
    name: "Women's",
    isDefault: false,
    items: [
      { key: 'Neck', min: 11, max: 18 },
      { key: 'Shoulder', min: 13, max: 20 },
      { key: 'Bust', min: 30, max: 54 },
      { key: 'Under-bust', min: 26, max: 48 },
      { key: 'Waist', min: 22, max: 46 },
      { key: 'Hip', min: 32, max: 58 },
      { key: 'Top length', min: 20, max: 30 },
      { key: 'Sleeve length', min: 6, max: 26 },
      { key: 'Round sleeve', min: 9, max: 20 },
      { key: 'Wrist', min: 5, max: 9 },
      { key: 'Gown length', min: 36, max: 64 },
      { key: 'Half length', min: 14, max: 22 },
      { key: 'Thigh', min: 18, max: 34 },
      { key: 'Knee', min: 12, max: 24 },
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
        const created = await templates.create((t) => {
          t.name = starter.name;
          t.isDefault = starter.isDefault;
        });
        if (starter.isDefault) defaultTemplateId = created.id;

        await Promise.all(
          starter.items.map((item, position) =>
            templateItems.create((ti) => {
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
