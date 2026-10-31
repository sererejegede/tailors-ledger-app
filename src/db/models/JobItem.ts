import { Model } from '@nozbe/watermelondb';
import type { Relation } from '@nozbe/watermelondb';
import { field, date, text, readonly, immutableRelation } from '@nozbe/watermelondb/decorators';
import { Tables } from '../schema';
import type Job from './Job';

export default class JobItem extends Model {
  static table = Tables.jobItems;

  static associations = {
    [Tables.jobs]: { type: 'belongs_to' as const, key: 'job_id' },
  };

  @text('description') description: string;
  @field('quantity') quantity: number;
  @field('unit_price_minor') unitPriceMinor?: number | null; // null until priced
  // Soft reference — the item outlives its measurement set (data-model §3).
  @text('set_id') setId?: string | null;
  @field('position') position: number;

  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;
  @date('deleted_at') deletedAt?: Date;

  @immutableRelation(Tables.jobs, 'job_id') job: Relation<Job>;
}
