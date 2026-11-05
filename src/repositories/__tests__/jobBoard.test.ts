import { Database } from '@nozbe/watermelondb';
import { makeTestDatabase } from '@/db/testDatabase';
import { ensureSeeded } from '@/db/seed';
import { createClient, softDeleteClient } from '../clients';
import { createJob, recordPayment, removeJobItem, jobItems, voidPayment } from '../jobs';
import { allJobRows, jobRowsForClient } from '../jobBoard';

describe('allJobRows', () => {
  let db: Database;

  beforeEach(async () => {
    db = makeTestDatabase();
    await ensureSeeded(db);
  });

  it('gives every job its client, label and totals', async () => {
    const tunde = await createClient(db, { name: 'Tunde Bello' });
    const amaka = await createClient(db, { name: 'Amaka Okafor' });
    await createJob(db, {
      clientId: tunde.id,
      title: 'Wedding outfits',
      collectOn: 1794614400000,
      items: [
        { description: 'Agbada', unitPriceMinor: 8500000 },
        { description: 'Senator suit', quantity: 2, unitPriceMinor: 3000000 },
      ],
      amountMinor: 5000000,
    });
    await createJob(db, { clientId: amaka.id, items: [{ description: 'Iro and buba' }, { description: 'Gele' }] });

    // Both jobs can share a created_at millisecond, so don't rely on their order here.
    const rows = (await allJobRows(db)).sort((a, b) => a.clientName.localeCompare(b.clientName));
    expect(rows.map((r) => [r.clientName, r.label, r.itemCount])).toEqual([
      ['Amaka Okafor', 'Iro and buba +1', 2],
      ['Tunde Bello', 'Wedding outfits', 2],
    ]);
    expect(rows[1]).toMatchObject({
      clientId: tunde.id,
      collectOn: 1794614400000,
      currency: 'NGN',
      totalMinor: 14500000,
      paidMinor: 5000000,
      balanceMinor: 9500000,
    });
    expect(rows[0]).toMatchObject({ collectOn: null, totalMinor: 0, paidMinor: 0 });
  });

  it('matches the job screen: voided payments and removed items don’t count', async () => {
    const client = await createClient(db, { name: 'Kemi Adeyemi' });
    const { job, payment } = await createJob(db, {
      clientId: client.id,
      items: [
        { description: 'Kaftan', unitPriceMinor: 2500000 },
        { description: 'Cap', unitPriceMinor: 500000 },
      ],
      amountMinor: 1000000,
    });
    await voidPayment(db, payment!.id);
    await recordPayment(db, job.id, 400000);
    const cap = (await jobItems(db, job.id))[1];
    await removeJobItem(db, cap.id);

    const [row] = await allJobRows(db);
    expect(row).toMatchObject({ itemCount: 1, totalMinor: 2500000, paidMinor: 400000, balanceMinor: 2100000 });
  });

  it('leaves out the jobs of a deleted client', async () => {
    const gone = await createClient(db, { name: 'Chidi Eze' });
    await createJob(db, { clientId: gone.id, items: [{ description: 'Agbada' }] });
    await softDeleteClient(db, gone.id);

    expect(await allJobRows(db)).toEqual([]);
  });
});

describe('jobRowsForClient', () => {
  let db: Database;

  beforeEach(async () => {
    db = makeTestDatabase();
    await ensureSeeded(db);
  });

  it('gives only that client’s jobs, with their own totals', async () => {
    const tunde = await createClient(db, { name: 'Tunde Bello' });
    const amaka = await createClient(db, { name: 'Amaka Okafor' });
    await createJob(db, {
      clientId: tunde.id,
      title: 'Wedding outfits',
      items: [{ description: 'Agbada', unitPriceMinor: 8500000 }],
      amountMinor: 5000000,
    });
    await createJob(db, {
      clientId: amaka.id,
      items: [{ description: 'Iro and buba', unitPriceMinor: 4000000 }],
      amountMinor: 1000000,
    });

    const rows = await jobRowsForClient(db, tunde.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      clientName: 'Tunde Bello',
      label: 'Wedding outfits',
      itemCount: 1,
      totalMinor: 8500000,
      paidMinor: 5000000,
      balanceMinor: 3500000,
    });
    expect(await jobRowsForClient(db, 'no-such-client')).toEqual([]);
  });
});
