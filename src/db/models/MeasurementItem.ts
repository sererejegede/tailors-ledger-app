import { Model, Query } from '@nozbe/watermelondb';
import type { Relation } from '@nozbe/watermelondb';
import { field, date, text, readonly, children, immutableRelation } from '@nozbe/watermelondb/decorators';
import { Tables } from '../schema';
import type MeasurementSet from './MeasurementSet';
import type MeasurementValue from './MeasurementValue';

/**
 * One measurement line inside a set. Holds a cached `current_value` for fast reads;
 * the source of truth for history is the append-only measurement_values table.
 */
export default class MeasurementItem extends Model {
  static table = Tables.measurementItems;

  static associations = {
    [Tables.measurementSets]: { type: 'belongs_to' as const, key: 'set_id' },
    [Tables.measurementValues]: { type: 'has_many' as const, foreignKey: 'item_id' },
  };

  @text('key') key: string;
  @field('position') position: number;
  @text('unit') unit: string;
  @field('current_value') currentValue?: number; // canonical decimal inches; null until measured
  @field('current_value_at') currentValueAt?: number;

  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;
  @date('deleted_at') deletedAt?: Date;

  @immutableRelation(Tables.measurementSets, 'set_id') set: Relation<MeasurementSet>;
  @children(Tables.measurementValues) values: Query<MeasurementValue>;
}
