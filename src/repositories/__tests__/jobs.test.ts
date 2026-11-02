import { Database } from '@nozbe/watermelondb';
import { makeTestDatabase } from '@/db/testDatabase';
import { ensureSeeded } from '@/db/seed';
import { Tables } from '@/db/schema';
import type Client from '@/db/models/Client';
import { getSettings, updateSettings } from '../settings';
import { createClient, updateClient } from '../clients';
import {
  addJobItem,
  createJob,
  InvalidJobError,
  jobItems,
  jobPayments,
  jobsForClient,
  jobSummary,
  nextReceiptNumber,
  peekNextReceiptNumber,
  receiptKind,
  recordPayment,
  removeJobItem,
  totalOwedMinor,
  totalsFor,
  updateJob,
  updateJobItem,
  voidPayment,
} from '../jobs';
import { countOrphans, purgeOrphans } from '../maintenance';

const wedding = [
  { description: 'Agbada, 3-piece', unitPriceMinor: 4500000 },
  { description: 'Senator suit', quantity: 2, unitPriceMinor: 3000000 },
  { description: 'Cap', unitPriceMinor: 500000 },
];

describe('totalsFor', () => {
  it('sums lines, leaves out voided payments and can go negative', () => {
    const items = [{ quantity: 2, unitPriceMinor: 3000 }, { quantity: 1, unitPriceMinor: null }];
    const payments = [{ amountMinor: 1000, voidedAt: null }, { amountMinor: 9999, voidedAt: 5 }];
    expect(totalsFor(items, payments)).toEqual({ totalMinor: 6000, paidMinor: 1000, balanceMinor: 5000 });
    expect(totalsFor([], [{ amountMinor: 100, voidedAt: null }]).balanceMinor).toBe(-100);
  });
});

describe('receiptKind', () => {
  it('names each payment', () => {
    expect(receiptKind(1000, 0, 400)).toBe('Deposit');
    expect(receiptKind(1000, 0, 1000)).toBe('Full payment');
    expect(receiptKind(1000, 400, 100)).toBe('Part payment');
    expect(receiptKind(1000, 400, 600)).toBe('Final payment');
  });

  it('treats a job with no prices yet as a deposit, not as cleared', () => {
    expect(receiptKind(0, 0, 400)).toBe('Deposit');
    expect(receiptKind(0, 400, 400)).toBe('Part payment');
  });
});

describe('nextReceiptNumber', () => {
  it('takes the higher of the setting and the device', () => {
    expect(nextReceiptNumber(null, 0)).toBe(1);
    expect(nextReceiptNumber(43, 0)).toBe(43);
    expect(nextReceiptNumber(10, 41)).toBe(42);
  });
});

describe('jobs repository', () => {
  let db: Database;
  let client: Client;

  beforeEach(async () => {
    db = makeTestDatabase();
    await ensureSeeded(db);
    client = await createClient(db, { name: 'Tunde Bello', phone: '+234 803 555 0142' });
  });

  describe('createJob', () => {
    it('saves the job, its items in order and a first receipt', async () => {
      const { job, payment } = await createJob(db, {
        clientId: client.id,
        title: 'Wedding outfits',
        items: wedding,
        amountMinor: 5000000,
      });

      expect(job.currency).toBe('NGN');
      expect((await jobItems(db, job.id)).map((i) => i.description)).toEqual([
        'Agbada, 3-piece',
        'Senator suit',
        'Cap',
      ]);
      expect(payment!.amountMinor).toBe(5000000);
      expect(payment!.receipt.kind).toBe('Deposit');

      const summary = await jobSummary(db, job.id);
      expect(summary).toMatchObject({
        itemCount: 3,
        totalMinor: 11000000,
        paidMinor: 5000000,
        balanceMinor: 6000000,
      });
    });

    it('takes the shop currency', async () => {
      await updateSettings(db, { currency: 'GBP' });
      const { job } = await createJob(db, { clientId: client.id, items: wedding });
      expect(job.currency).toBe('GBP');
    });

    it('records a job with no payment and uses no receipt number', async () => {
      const { payment } = await createJob(db, { clientId: client.id, items: wedding });
      expect(payment).toBeNull();
      expect(await db.get(Tables.payments).query().fetchCount()).toBe(0);
      expect((await getSettings(db))!.nextReceiptNumber ?? null).toBeNull();
    });

    it('allows unpriced items, with a deposit above the total so far', async () => {
      const { job, payment } = await createJob(db, {
        clientId: client.id,
        items: [{ description: 'Agbada' }],
        amountMinor: 1000000,
      });
      expect(payment!.receipt.items[0].unit_price_minor).toBeNull();
      expect((await jobSummary(db, job.id)).balanceMinor).toBe(-1000000);
    });

    it('keeps a soft link to a measurement set', async () => {
      const { job } = await createJob(db, {
        clientId: client.id,
        items: [{ description: 'Agbada', setId: 'set-1' }],
      });
      expect((await jobItems(db, job.id))[0].setId).toBe('set-1');
    });

    it('drops blank rows and refuses a job with no items, writing nothing', async () => {
      const { job } = await createJob(db, {
        clientId: client.id,
        items: [{ description: '  ' }, { description: 'Cap' }],
      });
      expect((await jobItems(db, job.id)).length).toBe(1);

      await expect(
        createJob(db, { clientId: client.id, items: [{ description: ' ' }] }),
      ).rejects.toBeInstanceOf(InvalidJobError);
      expect(await db.get(Tables.jobs).query().fetchCount()).toBe(1);
    });

    it.each([
      [{ amountMinor: -1 }],
      [{ amountMinor: 1.5 }],
      [{ items: [{ description: 'Cap', quantity: 0 }] }],
      [{ items: [{ description: 'Cap', unitPriceMinor: -5 }] }],
    ])('refuses bad input %j', async (bad) => {
      await expect(createJob(db, { clientId: client.id, items: wedding, ...bad })).rejects.toBeInstanceOf(
        InvalidJobError,
      );
      expect(await db.get(Tables.jobs).query().fetchCount()).toBe(0);
    });
  });

  describe('recordPayment', () => {
    it('adds the next receipt and updates the balance', async () => {
      const { job } = await createJob(db, { clientId: client.id, items: wedding, amountMinor: 5000000 });
      const second = await recordPayment(db, job.id, 1000000);
      const last = await recordPayment(db, job.id, 5000000);

      expect(second.receiptNumber).toBe(2);
      expect(second.receipt.kind).toBe('Part payment');
      expect(second.receipt.paid_so_far_minor).toBe(6000000);
      expect(last.receipt.kind).toBe('Final payment');
      expect(last.receipt.balance_minor).toBe(0);
      expect((await jobSummary(db, job.id)).balanceMinor).toBe(0);
      expect((await jobPayments(db, job.id)).length).toBe(3);
    });

    it('allows overpaying rather than blocking the tailor', async () => {
      const { job } = await createJob(db, { clientId: client.id, items: wedding });
      const p = await recordPayment(db, job.id, 12000000);
      expect(p.receipt.kind).toBe('Full payment');
      expect((await jobSummary(db, job.id)).balanceMinor).toBe(-1000000);
    });

    it('refuses zero', async () => {
      const { job } = await createJob(db, { clientId: client.id, items: wedding });
      await expect(recordPayment(db, job.id, 0)).rejects.toBeInstanceOf(InvalidJobError);
    });
  });

  describe('receipt numbers', () => {
    it('starts at 1 and counts across jobs and clients', async () => {
      const other = await createClient(db, { name: 'Ada Okafor' });
      const a = await createJob(db, { clientId: client.id, items: wedding, amountMinor: 100 });
      const b = await createJob(db, { clientId: other.id, items: wedding, amountMinor: 100 });
      expect([a.payment!.receiptNumber, b.payment!.receiptNumber]).toEqual([1, 2]);
    });

    it('shows the number the next receipt will really get', async () => {
      expect(await peekNextReceiptNumber(db)).toBe(1);
      await updateSettings(db, { nextReceiptNumber: 43 });
      await createJob(db, { clientId: client.id, items: wedding, amountMinor: 100 });
      await updateSettings(db, { nextReceiptNumber: 5 });
      expect(await peekNextReceiptNumber(db)).toBe(44);
    });

    it('continues from the number set in Settings', async () => {
      await updateSettings(db, { nextReceiptNumber: 43 });
      const { payment } = await createJob(db, { clientId: client.id, items: wedding, amountMinor: 100 });
      expect(payment!.receiptNumber).toBe(43);
      expect((await getSettings(db))!.nextReceiptNumber).toBe(44);
    });

    it('never goes backwards if Settings is set lower', async () => {
      await updateSettings(db, { nextReceiptNumber: 43 });
      await createJob(db, { clientId: client.id, items: wedding, amountMinor: 100 });
      await updateSettings(db, { nextReceiptNumber: 5 });
      const { payment } = await createJob(db, { clientId: client.id, items: wedding, amountMinor: 100 });
      expect(payment!.receiptNumber).toBe(44);
    });

    it('never reuses a voided number', async () => {
      const { payment } = await createJob(db, { clientId: client.id, items: wedding, amountMinor: 100 });
      await voidPayment(db, payment!.id);
      await updateSettings(db, { nextReceiptNumber: 1 });
      const next = await createJob(db, { clientId: client.id, items: wedding, amountMinor: 100 });
      expect(next.payment!.receiptNumber).toBe(2);
    });

    it('gives saves made at the same moment different numbers', async () => {
      const { job } = await createJob(db, { clientId: client.id, items: wedding });
      const [a, b] = await Promise.all([recordPayment(db, job.id, 100), recordPayment(db, job.id, 100)]);
      expect(new Set([a.receiptNumber, b.receiptNumber]).size).toBe(2);
    });
  });

  describe('frozen receipts', () => {
    it('keeps what it printed when everything around it changes', async () => {
      await updateSettings(db, { shopName: 'Kunle Couture', receiptFooter: 'Thank you.' });
      const { job, payment } = await createJob(db, {
        clientId: client.id,
        title: 'Wedding outfits',
        collectOn: 1794614400000,
        items: wedding,
        amountMinor: 5000000,
      });
      const printed = JSON.stringify(payment!.receipt);

      await updateSettings(db, { shopName: 'New name', receiptFooter: '' });
      await updateClient(db, client.id, { name: 'Tunde B.' });
      await updateJob(db, job.id, { title: 'Changed', collectOn: null });
      const items = await jobItems(db, job.id);
      await updateJobItem(db, items[0].id, { unitPriceMinor: 1 });
      await removeJobItem(db, items[1].id);
      await addJobItem(db, job.id, { description: 'Gele', unitPriceMinor: 1200000 });

      const [reloaded] = await jobPayments(db, job.id);
      expect(JSON.stringify(reloaded.receipt)).toBe(printed);
      expect(reloaded.receipt).toMatchObject({
        client_name: 'Tunde Bello',
        job_title: 'Wedding outfits',
        collect_on: 1794614400000,
        currency: 'NGN',
        shop: { name: 'Kunle Couture', footer: 'Thank you.' },
        total_minor: 11000000,
      });
      expect(reloaded.receipt.items[1]).toEqual({
        description: 'Senator suit',
        quantity: 2,
        unit_price_minor: 3000000,
        line_total_minor: 6000000,
      });
    });

    it('prints the job as it stood when the payment was taken', async () => {
      const { job } = await createJob(db, { clientId: client.id, items: wedding, amountMinor: 5000000 });
      await addJobItem(db, job.id, { description: 'Gele', unitPriceMinor: 1200000 });
      const p = await recordPayment(db, job.id, 1000000);
      expect(p.receipt.items.map((i) => i.description)).toContain('Gele');
      expect(p.receipt.total_minor).toBe(12200000);
    });
  });

  describe('voidPayment', () => {
    it('takes the amount off the balance and keeps the receipt', async () => {
      const { job, payment } = await createJob(db, { clientId: client.id, items: wedding, amountMinor: 5000000 });
      await voidPayment(db, payment!.id);

      expect((await jobSummary(db, job.id)).balanceMinor).toBe(11000000);
      const [kept] = await jobPayments(db, job.id);
      expect(kept.voidedAt).not.toBeNull();
      expect(kept.deletedAt ?? null).toBeNull();
    });

    it('changes nothing the second time', async () => {
      const { payment } = await createJob(db, { clientId: client.id, items: wedding, amountMinor: 100 });
      const first = (await voidPayment(db, payment!.id)).voidedAt;
      expect((await voidPayment(db, payment!.id)).voidedAt).toBe(first);
    });

    it('treats the next payment as the first once the deposit is voided', async () => {
      const { job, payment } = await createJob(db, { clientId: client.id, items: wedding, amountMinor: 5000000 });
      await voidPayment(db, payment!.id);
      expect((await recordPayment(db, job.id, 1000000)).receipt.kind).toBe('Deposit');
    });
  });

  describe('items', () => {
    it('adds to the end, and a removed item stops counting', async () => {
      const { job } = await createJob(db, { clientId: client.id, items: wedding });
      const added = await addJobItem(db, job.id, { description: 'Gele', unitPriceMinor: 1200000 });
      expect(added.position).toBe(3);

      await removeJobItem(db, added.id);
      const summary = await jobSummary(db, job.id);
      expect(summary.itemCount).toBe(3);
      expect(summary.totalMinor).toBe(11000000);
      expect(await db.get(Tables.jobItems).query().fetchCount()).toBe(4); // tombstone, not deleted
    });

    it('prices an unpriced item later', async () => {
      const { job } = await createJob(db, { clientId: client.id, items: [{ description: 'Agbada' }] });
      const [item] = await jobItems(db, job.id);
      await updateJobItem(db, item.id, { unitPriceMinor: 4500000 });
      expect((await jobSummary(db, job.id)).totalMinor).toBe(4500000);
    });

    it('refuses a blank edit', async () => {
      const { job } = await createJob(db, { clientId: client.id, items: wedding });
      const [item] = await jobItems(db, job.id);
      await expect(updateJobItem(db, item.id, { description: ' ' })).rejects.toBeInstanceOf(InvalidJobError);
    });
  });

  describe('jobsForClient', () => {
    it('lists only that client, and totals what they owe', async () => {
      const other = await createClient(db, { name: 'Ada Okafor' });
      await createJob(db, { clientId: client.id, title: 'Wedding', items: wedding, amountMinor: 5000000 });
      await createJob(db, { clientId: client.id, title: 'Overpaid', items: [{ description: 'Cap', unitPriceMinor: 100 }], amountMinor: 500 });
      await createJob(db, { clientId: other.id, items: wedding });

      const summaries = await jobsForClient(db, client.id);
      expect(summaries.map((s) => s.job.title).sort()).toEqual(['Overpaid', 'Wedding']);
      expect(totalOwedMinor(summaries)).toBe(6000000);
    });
  });

  describe('orphan clean-up', () => {
    it('removes a job whose client is gone, with its items and payments', async () => {
      await createJob(db, { clientId: client.id, items: wedding, amountMinor: 100 });
      await db.write(async () => {
        await client.destroyPermanently();
      });

      const report = await countOrphans(db);
      expect(report).toMatchObject({ jobs: 1, job_items: 3, payments: 1 });
      await purgeOrphans(db);
      expect(await db.get(Tables.payments).query().fetchCount()).toBe(0);
    });
  });
});
