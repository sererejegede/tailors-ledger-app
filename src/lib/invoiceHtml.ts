import { colors } from '@/theme/tokens';
import type { InvoiceView } from './invoice';
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

/** The invoice as an A5 page, for the PDF ("Invoice" on the design canvas). */
export function invoiceHtml(view: InvoiceView, opts: PaperOptions): string {
  const unpriced = view.unpriced
    ? `<div style="font-size:${em(12)};color:${SOFT};text-align:right">${esc(view.unpriced)}</div>`
    : '';

  const paid = view.paid
    ? `<div style="${ROW};padding-top:${em(6)}"><div>Paid so far</div><div style="${MONEY}">${esc(view.paid)}</div></div>`
    : '';

  const due = view.paidInFull
    ? `<div style="${ROW};align-items:center;margin-top:${em(12)};padding:${em(11)} ${em(16)};border-radius:${em(6)};border:1px solid ${colors.line2}">
         <div style="font-weight:700;color:${INK}">Balance</div>
         ${paidInFullHtml()}
       </div>`
    : `<div style="${ROW};align-items:center;margin-top:${em(12)};padding:${em(11)} ${em(16)};border-radius:${em(6)};background:${colors.accentTint};color:${colors.accentInk}">
         <div>
           <div style="font-weight:700">Balance due</div>
           ${view.collection ? `<div style="font-size:${em(12)}">Due on collection, ${esc(view.collection)}</div>` : ''}
         </div>
         <div style="${MONEY};font-size:${em(28)};font-weight:700">${esc(view.balance)}</div>
       </div>`;

  const bank = view.bank.length
    ? `<div style="margin-top:${em(14)};padding:${em(10)} ${em(16)};border:1px solid ${colors.line2};border-radius:${em(6)};break-inside:avoid">
         <div style="font-size:${em(12)};font-weight:700;letter-spacing:0.04em;margin-bottom:${em(4)}">Pay by bank transfer</div>
         ${view.bank
           .map(
             (line) => `<div style="display:flex;gap:${em(12)}">
               <div style="width:${em(120)};flex-shrink:0;color:${SOFT}">${esc(line.label)}</div>
               <div style="min-width:0;color:${INK};${line.number ? `${MONEY};font-weight:700` : 'font-weight:500'}">${esc(line.value)}</div>
             </div>`,
           )
           .join('')}
       </div>`
    : '';

  const body = `<div style="${ROW};align-items:baseline">
    <div style="font-weight:700;font-size:${em(13)};letter-spacing:0.12em">INVOICE</div>
    <div style="font-size:${em(12)};color:${SOFT}">${esc(view.date)}</div>
  </div>

  ${partiesHtml('Bill to', view.client, view.job)}
  ${itemsHtml(view.items, view.total)}
  ${unpriced}
  ${paid}
  ${due}
  ${bank}`;

  return paperHtml({ name: view.shopName, contact: view.shopContact, footer: view.footer }, body, opts);
}
