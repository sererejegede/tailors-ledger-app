import { colors } from '@/theme/tokens';
import type { ReceiptView } from './receipt';
import {
  INK,
  MONEY,
  ROW,
  SOFT,
  em,
  esc,
  itemsHtml,
  paidInFullHtml,
  paperHtml,
  partiesHtml,
  type PaperOptions,
} from './paperHtml';

/** The receipt as an A5 page, for the PDF (layout A on the design canvas). */
export function receiptHtml(view: ReceiptView, opts: PaperOptions): string {
  const received = view.voided
    ? `<div style="${ROW};align-items:center;margin-top:${em(12)};padding:${em(11)} ${em(16)};border-radius:${em(6)};border:2px solid ${colors.danger};color:${colors.danger}">
         <div style="font-weight:700;font-size:${em(20)};letter-spacing:0.16em">VOID</div>
         <div style="${MONEY};font-size:${em(24)};text-decoration:line-through">${esc(view.amount)}</div>
       </div>`
    : `<div style="${ROW};align-items:center;margin-top:${em(12)};padding:${em(11)} ${em(16)};border-radius:${em(6)};background:${colors.accentTint};color:${colors.accentInk}">
         <div>
           <div style="font-size:${em(12)}">Amount received</div>
           <div style="font-weight:700">${esc(view.kind)}</div>
         </div>
         <div style="${MONEY};font-size:${em(28)};font-weight:700">${esc(view.amount)}</div>
       </div>`;

  const balance = view.paidInFull
    ? paidInFullHtml()
    : `<div style="${MONEY};color:${colors.accent}">${esc(view.balance)}</div>`;

  const collection = view.collection
    ? `<div style="${ROW};padding-top:${em(4)}"><div>Collection</div><div style="font-weight:600">${esc(view.collection)}</div></div>`
    : '';

  const body = `<div style="${ROW};align-items:baseline">
    <div style="font-weight:700;font-size:${em(13)};letter-spacing:0.12em">RECEIPT</div>
    <div style="${MONEY};font-weight:700;color:${colors.accent}">${esc(view.number)}</div>
  </div>
  <div style="font-size:${em(12)};color:${SOFT};text-align:right">${esc(view.date)}</div>

  ${partiesHtml('Issued to', view.client, view.job)}
  ${itemsHtml(view.items, view.total)}

  ${received}

  <div style="${ROW};padding-top:${em(10)}">
    <div>Paid so far</div><div style="${MONEY}">${esc(view.paid)}</div>
  </div>
  <div style="${ROW};align-items:center;padding-top:${em(4)};font-size:${em(17)};font-weight:700;color:${INK}">
    <div>Balance</div>
    ${balance}
  </div>
  ${collection}`;

  return paperHtml({ name: view.shopName, contact: view.shopContact, footer: view.footer }, body, opts);
}
