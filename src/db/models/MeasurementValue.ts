import { Model } from '@nozbe/watermelondb';
import type { Relation } from '@nozbe/watermelondb';
import { field, date, text, readonly, immutableRelation } from '@nozbe/watermelondb/decorators';
import { Tables } from '../schema';
import type MeasurementItem from './MeasurementItem';

/**
 * Append-only history row (data-model §3, §4). NEVER updated, NEVER deleted — so it
 * has no `updated_at` / `deleted_at`. The newest by `recorded_at` is the current value.
 */
export default class MeasurementValue extends Model {
  static table = Tables.measurementValues;

  static associations = {
    [Tables.measurementItems]: { type: 'belongs_to' as const, key: 'item_id' },
  };

  @field('value') value: number; // canonical decimal inches
  @field('recorded_at') recordedAt: number;
  @text('source') source?: string; // 'manual' | 'voice' (future)

  @readonly @date('created_at') createdAt: Date;

  @immutableRelation(Tables.measurementItems, 'item_id') item: Relation<MeasurementItem>;
}
