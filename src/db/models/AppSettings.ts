import { Model } from '@nozbe/watermelondb';
import { field, date, text, readonly } from '@nozbe/watermelondb/decorators';
import { Tables } from '../schema';

/**
 * Single local row of device settings (data-model §3). Mostly device-local; only the
 * shop profile + default_template_id are candidates to sync if multi-device is added.
 */
export default class AppSettings extends Model {
  static table = Tables.appSettings;

  @text('units') units: string; // 'in' (cm reserved for future)
  @text('fraction_granularity') fractionGranularity: string; // 'quarters' | 'eighths'
  @text('default_template_id') defaultTemplateId?: string;
  @text('shop_name') shopName?: string;
  @text('logo_uri') logoUri?: string;
  @field('app_lock_enabled') appLockEnabled: boolean;
  @text('text_size') textSize: string; // 'normal' | 'large'
  @field('high_contrast') highContrast: boolean;
  @field('range_warnings_enabled') rangeWarningsEnabled: boolean;
  @field('last_synced_at') lastSyncedAt?: number;
  @text('sync_cursor') syncCursor?: string;

  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;
}
