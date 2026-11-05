import { Database, Q } from '@nozbe/watermelondb';
import { Tables } from '@/db/schema';
import type Client from '@/db/models/Client';
import type Job from '@/db/models/Job';
import type JobItem from '@/db/models/JobItem';
import type Payment from '@/db/models/Payment';
import type { JobRow } from '@/lib/jobBoard';
import { jobLabel, totalsFor } from './jobs';
import { notDeleted } from './softDelete';

/**
 * Every job with its client's name and its totals, for the Jobs tab and the Clients home
 * tiles. Reads each table once and groups in memory, rather than one query per job.
 * Jobs of a deleted client are left out. Nothing here is stored: totals come from
 * `totalsFor`, like everywhere else.
 */
export async function allJobRows(database: Database): Promise<JobRow[]> {
  return jobRows(database, []);
}

/** One client's jobs, newest first, for Client detail (S2) and all their jobs (S2a). */
export async function jobRowsForClient(database: Database, clientId: string): Promise<JobRow[]> {
  return jobRows(database, [Q.where('client_id', clientId)], clientId);
}

async function jobRows(database: Database, jobWhere: Q.Clause[], clientId?: string): Promise<JobRow[]> {
  // For one client, read only that client's items and payments.
  const ofJob = clientId ? [Q.on(Tables.jobs, [Q.where('client_id', clientId), notDeleted])] : [];
  const [jobs, items, payments, clients] = await Promise.all([
    database.get<Job>(Tables.jobs).query(...jobWhere, notDeleted, Q.sortBy('created_at', Q.desc)).fetch(),
    database.get<JobItem>(Tables.jobItems).query(...ofJob, notDeleted, Q.sortBy('position', Q.asc)).fetch(),
    database.get<Payment>(Tables.payments).query(...ofJob, notDeleted).fetch(),
    database
      .get<Client>(Tables.clients)
      .query(...(clientId ? [Q.where('id', clientId)] : []), notDeleted)
      .fetch(),
  ]);

  const names = new Map(clients.map((c) => [c.id, c.name]));
  const itemsByJob = groupBy(items, (i) => i.job.id);
  const paymentsByJob = groupBy(payments, (p) => p.job.id);

  const rows: JobRow[] = [];
  for (const job of jobs) {
    const clientId = job.client.id;
    const clientName = names.get(clientId);
    if (clientName == null) continue;
    const jobItems = itemsByJob.get(job.id) ?? [];
    rows.push({
      jobId: job.id,
      clientId,
      clientName,
      label: jobLabel(job, jobItems),
      itemCount: jobItems.length,
      currency: job.currency,
      collectOn: job.collectOn ?? null,
      createdAt: job.createdAt.getTime(),
      ...totalsFor(jobItems, paymentsByJob.get(job.id) ?? []),
    });
  }
  return rows;
}

function groupBy<T>(list: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of list) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}
