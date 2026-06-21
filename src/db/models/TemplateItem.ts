import { Model } from '@nozbe/watermelondb';
import { field, date, text, readonly, immutableRelation } from '@nozbe/watermelondb/decorators';
import type { Relation } from '@nozbe/watermelondb';
import { Tables } from '../schema';
import type Template from './Template';

export default class TemplateItem extends Model {
  static table = Tables.templateItems;

  static associations = {
    [Tables.templates]: { type: 'belongs_to' as const, key: 'template_id' },
  };

  @text('key') key: string;
  @field('position') position: number;
  @text('unit') unit: string;
  @field('min_range') minRange?: number;
  @field('max_range') maxRange?: number;

  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;
  @date('deleted_at') deletedAt?: Date;

  @immutableRelation(Tables.templates, 'template_id') template: Relation<Template>;
}
