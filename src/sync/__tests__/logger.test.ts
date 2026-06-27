import { rejectionReport, envelopeSummary } from '../logger';
import { _internal } from '../mapper';
import type { RejectedRow } from '../types';

/** Build a push-like envelope with the rows the tests reference. */
function envelopeWith(parts: {
  clientsUpdated?: string[];
  setsCreated?: { id: string; client_id: string }[];
  itemsCreated?: { id: string; set_id: string }[];
}) {
  const env = _internal.emptyEnvelope();
  for (const id of parts.clientsUpdated ?? []) env.clients.updated.push({ id, name: 'X' });
  for (const s of parts.setsCreated ?? [])
    env.measurement_sets.created.push({ id: s.id, client_id: s.client_id, template_id: null });
  for (const i of parts.itemsCreated ?? [])
    env.measurement_items.created.push({ id: i.id, set_id: i.set_id });
  return env;
}

describe('rejectionReport — cross-check vs envelope', () => {
  it('reports a parent that was sent in `updated` (closure) for a rejected child', () => {
    const env = envelopeWith({
      clientsUpdated: ['c1'],
      setsCreated: [{ id: 's1', client_id: 'c1' }],
    });
    const rejected: RejectedRow[] = [
      { entity: 'measurement_sets', id: 's1', reason: 'client_id_not_found' },
    ];

    const report = rejectionReport(env, rejected);
    // The set's parent client was present in our push, but in the `updated` bucket.
    expect(report).toContain('measurement_sets/client_id_not_found ×1');
    expect(report).toContain('updated=1');
    expect(report).toContain('absent=0');
  });

  it('flags a pure cascade (child rejected because its parent was also rejected)', () => {
    const env = envelopeWith({
      setsCreated: [{ id: 's1', client_id: 'c1' }],
      itemsCreated: [{ id: 'i1', set_id: 's1' }],
    });
    const rejected: RejectedRow[] = [
      { entity: 'measurement_sets', id: 's1', reason: 'client_id_not_found' },
      { entity: 'measurement_items', id: 'i1', reason: 'set_id_not_found' },
    ];

    const report = rejectionReport(env, rejected);
    // i1's parent set s1 is present (created) AND itself rejected → cascade.
    expect(report).toContain('measurement_items/set_id_not_found ×1');
    expect(report).toContain('parent-also-rejected=1');
  });

  it('flags an absent parent (client never sent it)', () => {
    const env = envelopeWith({ setsCreated: [{ id: 's1', client_id: 'c-missing' }] });
    const rejected: RejectedRow[] = [
      { entity: 'measurement_sets', id: 's1', reason: 'client_id_not_found' },
    ];
    expect(rejectionReport(env, rejected)).toContain('absent=1');
  });

  it('returns a friendly string when nothing was rejected', () => {
    expect(rejectionReport(_internal.emptyEnvelope(), [])).toBe('(none rejected)');
  });
});

describe('envelopeSummary — partial/undefined safety', () => {
  it('does not throw on a partial envelope and skips empty entities', () => {
    const partial = { clients: { created: [{ id: 'c1' }], updated: [], deleted: [] } } as never;
    expect(envelopeSummary(partial)).toBe('clients:c1/u0/d0');
    expect(envelopeSummary(undefined)).toBe('(none)');
  });
});
