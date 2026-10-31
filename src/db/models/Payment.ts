import { Model } from '@nozbe/watermelondb';
import type { Relation } from '@nozbe/watermelondb';
import { field, date, json, readonly, immutableRelation } from '@nozbe/watermelondb/decorators';
import { Tables } from '../schema';
import type Job from './Job';

export type ReceiptKind = 'Deposit' | 'Part payment' | 'Final payment' | 'Full payment';

/** One line on a receipt, frozen at save. */
export type ReceiptLine = {
  description: string;
  quantity: number;
  unit_price_minor: number | null;
  line_total_minor: number;
};

/** What a receipt printed, frozen at save (data-model §3). Keys are snake_case because
 * this crosses the wire as `receipt_json`. */
export type ReceiptSnapshot = {
  v: 1;
  kind: ReceiptKind;
  shop: { name: string; phone: string; address: string; footer: string };
  client_name: string;
  job_title: string | null;
  collect_on: number | null;
  currency: string;
  items: ReceiptLine[];
  total_minor: number;
  paid_so_far_minor: number;
  balance_minor: number;
};

/**
 * A payment is a receipt (data-model §3): voided, never edited or deleted, so `voided_at`
 * is the only field that changes after save. `deleted_at` exists for the sync pipeline.
 */
export default class Payment extends Model {
  static table = Tables.payments;

  static associations = {
    [Tables.jobs]: { type: 'belongs_to' as const, key: 'job_id' },
  };

  @field('receipt_number') receiptNumber: number;
  @field('amount_minor') amountMinor: number;
  @field('paid_at') paidAt: number;
  @json('receipt_json', (raw) => raw) receipt: ReceiptSnapshot;
  @field('voided_at') voidedAt?: number | null;

  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;
  @date('deleted_at') deletedAt?: Date;

  @immutableRelation(Tables.jobs, 'job_id') job: Relation<Job>;
}
