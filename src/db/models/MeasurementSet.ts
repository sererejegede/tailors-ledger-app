import { Model, Query } from '@nozbe/watermelondb';
import type { Relation } from '@nozbe/watermelondb';
import { field, date, text, readonly, children, immutableRelation } from '@nozbe/watermelondb/decorators';
import { Tables } from '../schema';
import type Client from './Client';
import type MeasurementItem from './MeasurementItem';
import type ImageRecord from './ImageRecord';

export default class MeasurementSet extends Model {
  static table = Tables.measurementSets;

  static associations = {
    [Tables.clients]: { type: 'belongs_to' as const, key: 'client_id' },
    [Tables.measurementItems]: { type: 'has_many' as const, foreignKey: 'set_id' },
    [Tables.images]: { type: 'has_many' as const, foreignKey: 'set_id' },
  };

  // Soft reference — template may later be renamed or deleted, so we also snapshot its name.
  @text('template_id') templateId?: string;
  @text('template_name_snapshot') templateNameSnapshot?: string;
  @text('label') label?: string;
  @text('note') note?: string;

  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;
  @date('deleted_at') deletedAt?: Date;

  @immutableRelation(Tables.clients, 'client_id') client: Relation<Client>;
  @children(Tables.measurementItems) items: Query<MeasurementItem>;
  @children(Tables.images) images: Query<ImageRecord>;
}
