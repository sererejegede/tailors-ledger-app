import { Model, Query } from '@nozbe/watermelondb';
import { field, date, text, readonly, children } from '@nozbe/watermelondb/decorators';
import { Tables } from '../schema';
import type MeasurementSet from './MeasurementSet';

export default class Client extends Model {
  static table = Tables.clients;

  static associations = {
    [Tables.measurementSets]: { type: 'has_many' as const, foreignKey: 'client_id' },
  };

  @text('name') name: string;
  @text('phone') phone?: string;
  @text('comment') comment?: string;
  @text('photo_local_uri') photoLocalUri?: string;
  @text('photo_remote_url') photoRemoteUrl?: string;

  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;
  @date('deleted_at') deletedAt?: Date;

  @children(Tables.measurementSets) sets: Query<MeasurementSet>;
}
