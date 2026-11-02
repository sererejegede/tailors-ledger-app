import { Model, Query } from '@nozbe/watermelondb';
import type { Relation } from '@nozbe/watermelondb';
import { field, date, text, readonly, children, immutableRelation } from '@nozbe/watermelondb/decorators';
import { Tables } from '../schema';
import type Client from './Client';
import type JobItem from './JobItem';
import type Payment from './Payment';

/**
 * One piece of work for one client (data-model §3). The total and balance are never
 * stored: they're calculated from its items and payments (see repositories/jobs.ts).
 */
export default class Job extends Model {
  static table = Tables.jobs;

  static associations = {
    [Tables.clients]: { type: 'belongs_to' as const, key: 'client_id' },
    [Tables.jobItems]: { type: 'has_many' as const, foreignKey: 'job_id' },
    [Tables.payments]: { type: 'has_many' as const, foreignKey: 'job_id' },
  };

  @text('title') title?: string;
  @text('currency') currency: string;
  @field('collect_on') collectOn?: number | null;
  @text('note') note?: string;

  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;
  @date('deleted_at') deletedAt?: Date;

  @immutableRelation(Tables.clients, 'client_id') client: Relation<Client>;
  @children(Tables.jobItems) items: Query<JobItem>;
  @children(Tables.payments) payments: Query<Payment>;
}
