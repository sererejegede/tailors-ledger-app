import { Model, Query } from '@nozbe/watermelondb';
import { field, date, text, readonly, children } from '@nozbe/watermelondb/decorators';
import { Tables } from '../schema';
import type TemplateItem from './TemplateItem';

export default class Template extends Model {
  static table = Tables.templates;

  static associations = {
    [Tables.templateItems]: { type: 'has_many' as const, foreignKey: 'template_id' },
  };

  @text('name') name: string;
  @field('is_default') isDefault: boolean;

  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;
  @date('deleted_at') deletedAt?: Date;

  @children(Tables.templateItems) items: Query<TemplateItem>;
}
