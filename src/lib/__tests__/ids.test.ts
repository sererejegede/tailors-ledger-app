import { seededId } from '../ids';
import { STARTER_TEMPLATES } from '@/db/seed';

/**
 * seededId backs cross-device merge of the starter templates: the same seed string MUST give
 * the same id on every device, and the ids across the whole starter set must not collide.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('seededId', () => {
  it('is deterministic for a given seed', () => {
    expect(seededId('template:Men\'s')).toBe(seededId('template:Men\'s'));
  });

  it('produces a valid v7-shaped uuid', () => {
    expect(seededId('template:Women\'s')).toMatch(UUID_RE);
  });

  it('gives different ids for different seeds', () => {
    expect(seededId('template:Men\'s')).not.toBe(seededId('template:Women\'s'));
  });

  it('has no collisions across the entire starter template + item set', () => {
    const ids = new Set<string>();
    for (const t of STARTER_TEMPLATES) {
      ids.add(seededId(`template:${t.name}`));
      for (const item of t.items) ids.add(seededId(`template-item:${t.name}:${item.key}`));
    }
    const total = STARTER_TEMPLATES.length + STARTER_TEMPLATES.reduce((n, t) => n + t.items.length, 0);
    expect(ids.size).toBe(total);
  });
});
