import { Model } from '@nozbe/watermelondb';
import type { Relation } from '@nozbe/watermelondb';
import { field, date, text, readonly, immutableRelation } from '@nozbe/watermelondb/decorators';
import { Tables } from '../schema';
import type MeasurementSet from './MeasurementSet';

/**
 * Image metadata only — bytes live on the device filesystem and upload out-of-band
 * (contract §8). `local_uri` / `upload_status` are device-local and never cross the
 * wire (contract §11). Named ImageRecord to avoid clashing with the DOM `Image`.
 */
export default class ImageRecord extends Model {
  static table = Tables.images;

  static associations = {
    [Tables.measurementSets]: { type: 'belongs_to' as const, key: 'set_id' },
  };

  @text('kind') kind: string; // 'card' | 'camera' | 'gallery'
  @text('local_uri') localUri: string;
  @text('remote_url') remoteUrl?: string;
  @text('upload_status') uploadStatus: string; // 'pending' | 'uploading' | 'uploaded' | 'failed'
  @field('width') width?: number;
  @field('height') height?: number;

  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;
  @date('deleted_at') deletedAt?: Date;

  @immutableRelation(Tables.measurementSets, 'set_id') set: Relation<MeasurementSet>;
}
