import { Database, Q } from '@nozbe/watermelondb';
import { Tables } from '@/db/schema';
import AppSettings from '@/db/models/AppSettings';
import Client from '@/db/models/Client';
import Job from '@/db/models/Job';
import JobItem from '@/db/models/JobItem';
import Payment, { type ReceiptKind, type ReceiptSnapshot } from '@/db/models/Payment';
import type { InvoiceSource } from '@/lib/invoice';
import { DEFAULT_CURRENCY, lineTotalMinor } from '@/lib/money';
import { nowMs } from '@/lib/time';
import { notDeleted, softDeleteById } from './softDelete';

/**
 * Job repository. A job is one piece of work for one client: its items and the payments
 * towards them. Every payment is one receipt (data-model §3).
 *
 * Totals and balances are always calculated here, never stored. A job is written whole on
 * save, like a set (lazy create, §1a), so backing out of New job leaves nothing.
 */

export class InvalidJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidJobError';
  }
}

export type NewJobItem = {
  description: string;
  quantity?: number;
  unitPriceMinor?: number | null;
  setId?: string | null;
};

export type CreateJob = {
  clientId: string;
  title?: string;
  collectOn?: number | null;
  note?: string;
  items: NewJobItem[];
  /** Paid now. Leave out or 0 to record the job with no payment and no receipt. */
  amountMinor?: number;
};

export type JobPatch = Partial<{ title: string; collectOn: number | null; note: string }>;
export type JobItemPatch = Partial<{
  description: string;
  quantity: number;
  unitPriceMinor: number | null;
  setId: string | null;
}>;

export type JobTotals = { totalMinor: number; paidMinor: number; balanceMinor: number };
export type JobSummary = JobTotals & { job: Job; label: string; itemCount: number };

type Priced = Pick<JobItem, 'quantity' | 'unitPriceMinor'>;
type Paid = Pick<Payment, 'amountMinor' | 'voidedAt'>;

/** The one place totals are worked out. Voided payments don't count. */
export function totalsFor(items: Priced[], payments: Paid[]): JobTotals {
  const totalMinor = items.reduce((sum, i) => sum + lineTotalMinor(i.quantity, i.unitPriceMinor), 0);
  const paidMinor = payments.reduce((sum, p) => sum + (p.voidedAt == null ? p.amountMinor : 0), 0);
  return { totalMinor, paidMinor, balanceMinor: totalMinor - paidMinor };
}

/** What a payment is called on its receipt (data-model §3). */
export function receiptKind(totalMinor: number, paidBeforeMinor: number, amountMinor: number): ReceiptKind {
  const clears = totalMinor > 0 && paidBeforeMinor + amountMinor >= totalMinor;
  if (paidBeforeMinor === 0) return clears ? 'Full payment' : 'Deposit';
  return clears ? 'Final payment' : 'Part payment';
}

/** The next receipt number: the higher of the Settings value and the device's highest + 1. */
export function nextReceiptNumber(settingsNext: number | null | undefined, highest: number): number {
  return Math.max(settingsNext ?? 1, highest + 1);
}

async function highestReceiptNumber(database: Database): Promise<number> {
  const [highest] = await database
    .get<Payment>(Tables.payments)
    .query(Q.sortBy('receipt_number', Q.desc), Q.take(1))
    .fetch();
  return highest?.receiptNumber ?? 0;
}

/** The number the next receipt will get (Settings shows this). */
export async function peekNextReceiptNumber(database: Database): Promise<number> {
  const settings = await requireSettings(database);
  return nextReceiptNumber(settings.nextReceiptNumber, await highestReceiptNumber(database));
}

function assertAmount(amountMinor: number): void {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new InvalidJobError('A payment must be more than zero.');
  }
}

function assertItem(item: { description?: string; quantity?: number; unitPriceMinor?: number | null }): void {
  if (item.description !== undefined && !item.description.trim()) {
    throw new InvalidJobError('An item needs a description.');
  }
  if (item.quantity !== undefined && (!Number.isInteger(item.quantity) || item.quantity < 1)) {
    throw new InvalidJobError('An item needs a quantity of at least 1.');
  }
  if (item.unitPriceMinor != null && (!Number.isInteger(item.unitPriceMinor) || item.unitPriceMinor < 0)) {
    throw new InvalidJobError('An item price cannot be negative.');
  }
}

async function requireSettings(database: Database): Promise<AppSettings> {
  const settings = (await database.get<AppSettings>(Tables.appSettings).query().fetch())[0];
  if (!settings) throw new Error('app_settings row missing — seed the database first');
  return settings;
}

/**
 * Write one payment and its frozen receipt, and move the receipt counter on. Must run
 * inside a `database.write`: that's what stops two saves minting the same number.
 */
async function writePayment(
  database: Database,
  job: Job,
  client: Client,
  items: JobItem[],
  payments: Paid[],
  amountMinor: number,
): Promise<Payment> {
  const settings = await requireSettings(database);
  const number = nextReceiptNumber(settings.nextReceiptNumber, await highestReceiptNumber(database));

  const { totalMinor, paidMinor } = totalsFor(items, payments);
  const receipt: ReceiptSnapshot = {
    v: 1,
    kind: receiptKind(totalMinor, paidMinor, amountMinor),
    shop: {
      name: settings.shopName ?? '',
      phone: settings.shopPhone ?? '',
      address: settings.shopAddress ?? '',
      footer: settings.receiptFooter ?? '',
    },
    client_name: client.name,
    job_title: job.title || null,
    collect_on: job.collectOn ?? null,
    currency: job.currency,
    items: items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_price_minor: i.unitPriceMinor ?? null,
      line_total_minor: lineTotalMinor(i.quantity, i.unitPriceMinor),
    })),
    total_minor: totalMinor,
    paid_so_far_minor: paidMinor + amountMinor,
    balance_minor: totalMinor - paidMinor - amountMinor,
  };

  const payment = await database.get<Payment>(Tables.payments).create((p) => {
    p.job!.id = job.id;
    p.receiptNumber = number;
    p.amountMinor = amountMinor;
    p.paidAt = nowMs();
    p.receipt = receipt;
  });
  await settings.update((s) => {
    s.nextReceiptNumber = number + 1;
  });
  return payment;
}

/** Save a new job with its items and, when money changed hands, its first payment. */
export async function createJob(
  database: Database,
  input: CreateJob,
): Promise<{ job: Job; payment: Payment | null }> {
  const lines = input.items.filter((i) => i.description.trim());
  if (!lines.length) throw new InvalidJobError('A job needs at least one item.');
  lines.forEach(assertItem);
  const amountMinor = input.amountMinor ?? 0;
  if (amountMinor !== 0) assertAmount(amountMinor);

  const client = await database.get<Client>(Tables.clients).find(input.clientId);
  const settings = await requireSettings(database);

  return database.write(async () => {
    const job = await database.get<Job>(Tables.jobs).create((j) => {
      j.client!.id = client.id;
      j.currency = settings.currency || DEFAULT_CURRENCY;
      if (input.title != null) j.title = input.title;
      if (input.collectOn != null) j.collectOn = input.collectOn;
      if (input.note != null) j.note = input.note;
    });

    const itemsCol = database.get<JobItem>(Tables.jobItems);
    const items: JobItem[] = [];
    for (const [position, line] of lines.entries()) {
      items.push(
        await itemsCol.create((i) => {
          i.job!.id = job.id;
          i.description = line.description;
          i.quantity = line.quantity ?? 1;
          i.position = position;
          if (line.unitPriceMinor != null) i.unitPriceMinor = line.unitPriceMinor;
          if (line.setId != null) i.setId = line.setId;
        }),
      );
    }

    const payment = amountMinor ? await writePayment(database, job, client, items, [], amountMinor) : null;
    return { job, payment };
  });
}

/** Take the next payment on a job. Overpaying is allowed: the balance just goes negative. */
export async function recordPayment(
  database: Database,
  jobId: string,
  amountMinor: number,
): Promise<Payment> {
  assertAmount(amountMinor);
  const job = await database.get<Job>(Tables.jobs).find(jobId);
  const client = await job.client.fetch();
  return database.write(async () => {
    const [items, payments] = await Promise.all([jobItems(database, jobId), jobPayments(database, jobId)]);
    return writePayment(database, job, client as Client, items, payments, amountMinor);
  });
}

/** Void a receipt. Its number stays used, and voiding twice changes nothing. */
export async function voidPayment(database: Database, paymentId: string): Promise<Payment> {
  const payment = await database.get<Payment>(Tables.payments).find(paymentId);
  if (payment.voidedAt != null) return payment;
  await database.write(async () => {
    await payment.update((p) => {
      p.voidedAt = nowMs();
    });
  });
  return payment;
}

export async function updateJob(database: Database, id: string, patch: JobPatch): Promise<Job> {
  const job = await database.get<Job>(Tables.jobs).find(id);
  await database.write(async () => {
    await job.update((j) => {
      if (patch.title !== undefined) j.title = patch.title;
      if (patch.collectOn !== undefined) j.collectOn = patch.collectOn;
      if (patch.note !== undefined) j.note = patch.note;
    });
  });
  return job;
}

export async function addJobItem(database: Database, jobId: string, item: NewJobItem): Promise<JobItem> {
  assertItem(item);
  const existing = await jobItems(database, jobId);
  const position = existing.reduce((max, i) => Math.max(max, i.position + 1), 0);
  return database.write(() =>
    database.get<JobItem>(Tables.jobItems).create((i) => {
      i.job!.id = jobId;
      i.description = item.description;
      i.quantity = item.quantity ?? 1;
      i.position = position;
      if (item.unitPriceMinor != null) i.unitPriceMinor = item.unitPriceMinor;
      if (item.setId != null) i.setId = item.setId;
    }),
  );
}

export async function updateJobItem(database: Database, id: string, patch: JobItemPatch): Promise<JobItem> {
  assertItem(patch);
  const item = await database.get<JobItem>(Tables.jobItems).find(id);
  await database.write(async () => {
    await item.update((i) => {
      if (patch.description !== undefined) i.description = patch.description;
      if (patch.quantity !== undefined) i.quantity = patch.quantity;
      if (patch.unitPriceMinor !== undefined) i.unitPriceMinor = patch.unitPriceMinor;
      if (patch.setId !== undefined) i.setId = patch.setId;
    });
  });
  return item;
}

export async function removeJobItem(database: Database, id: string): Promise<void> {
  await softDeleteById<JobItem>(database, Tables.jobItems, id);
}

/** A job's items in order. */
export async function jobItems(database: Database, jobId: string): Promise<JobItem[]> {
  return database
    .get<JobItem>(Tables.jobItems)
    .query(Q.where('job_id', jobId), notDeleted, Q.sortBy('position', Q.asc))
    .fetch();
}

/** A job's payments, oldest first, voided ones included (they stay on the job's record). */
export async function jobPayments(database: Database, jobId: string): Promise<Payment[]> {
  return database
    .get<Payment>(Tables.payments)
    .query(Q.where('job_id', jobId), notDeleted, Q.sortBy('paid_at', Q.asc))
    .fetch();
}

export async function jobSummary(database: Database, jobId: string): Promise<JobSummary> {
  const [job, items, payments] = await Promise.all([
    database.get<Job>(Tables.jobs).find(jobId),
    jobItems(database, jobId),
    jobPayments(database, jobId),
  ]);
  return { job, label: jobLabel(job, items), itemCount: items.length, ...totalsFor(items, payments) };
}

/** What a job is called: its title, or its first item. */
export function jobLabel(job: Job, items: JobItem[]): string {
  if (job.title) return job.title;
  const [first, ...rest] = items;
  if (!first) return 'Job';
  return rest.length ? `${first.description} +${rest.length}` : first.description;
}

export async function getPayment(database: Database, id: string): Promise<Payment> {
  return database.get<Payment>(Tables.payments).find(id);
}

/** A client's jobs, newest first, with what each still owes (Client detail). */
export async function jobsForClient(database: Database, clientId: string): Promise<JobSummary[]> {
  const jobs = await database
    .get<Job>(Tables.jobs)
    .query(Q.where('client_id', clientId), notDeleted, Q.sortBy('created_at', Q.desc))
    .fetch();
  return Promise.all(jobs.map((j) => jobSummary(database, j.id)));
}

/** What a client owes across their jobs. A job that's overpaid doesn't offset another. */
export function totalOwedMinor(summaries: JobTotals[]): number {
  return summaries.reduce((sum, s) => sum + Math.max(s.balanceMinor, 0), 0);
}

/**
 * Everything an invoice is drawn from, read fresh each time it's opened, so it always shows
 * the job as it is now (data-model §3, "Invoices"). Also the logo, which is a local file.
 */
export async function invoiceSource(
  database: Database,
  jobId: string,
): Promise<{ source: InvoiceSource; logoUri?: string }> {
  const job = await database.get<Job>(Tables.jobs).find(jobId);
  const [client, items, payments, settings] = await Promise.all([
    job.client.fetch() as Promise<Client>,
    jobItems(database, jobId),
    jobPayments(database, jobId),
    requireSettings(database),
  ]);
  return {
    source: {
      date: nowMs(),
      shop: {
        name: settings.shopName ?? '',
        phone: settings.shopPhone ?? '',
        address: settings.shopAddress ?? '',
        footer: settings.receiptFooter ?? '',
      },
      bank: {
        name: settings.bankName ?? '',
        accountName: settings.bankAccountName ?? '',
        accountNumber: settings.bankAccountNumber ?? '',
      },
      clientName: client.name,
      clientPhone: client.phone ?? '',
      jobTitle: job.title || null,
      collectOn: job.collectOn ?? null,
      currency: job.currency,
      items: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPriceMinor: i.unitPriceMinor ?? null,
      })),
      payments: payments.map((p) => ({ amountMinor: p.amountMinor, voidedAt: p.voidedAt ?? null })),
    },
    logoUri: settings.logoUri || undefined,
  };
}
