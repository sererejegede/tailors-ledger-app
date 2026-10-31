import { colors } from '@/theme/tokens';
import type { ReceiptView } from './receipt';

/**
 * The receipt as an A5 page, for the PDF (layout A on the design canvas). Fonts are the
 * system's, not the app's: this has to work offline, where a web font can't load.
 *
 * Sizes are in `em` off a base set from the page width, so the one layout fits both the
 * native PDF (420 wide, 1px = 1pt) and the browser's print page (559 wide).
 */

const INK = '#2F3132';
const SOFT = '#6B675E';
const DESIGN_WIDTH = 559;
const DESIGN_FONT = 14;
const A5_RATIO = 210 / 148;

const SANS = "Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = 'Menlo, Consolas, monospace';

/** A size from the design, in px at the design's 14px base. */
const em = (px: number) => `${(px / DESIGN_FONT).toFixed(3)}em`;

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function receiptHtml(view: ReceiptView, opts: { logoSrc: string | null; pageWidth: number }): string {
  const { logoSrc, pageWidth } = opts;
  const base = (pageWidth / DESIGN_WIDTH) * DESIGN_FONT;
  const money = `font-family:${MONO}`;
  const row = 'display:flex;justify-content:space-between';

  const logo = logoSrc
    ? `<img src="${esc(logoSrc)}" style="width:${em(60)};height:${em(60)};margin-bottom:${em(6)};border-radius:50%;object-fit:cover" />`
    : '';

  const job = view.job
    ? `<div style="flex:1;min-width:0;text-align:right">
         <div style="font-size:${em(12)};color:${SOFT}">Job</div>
         <div style="font-weight:500">${esc(view.job)}</div>
       </div>`
    : '';

  const items = view.items
    .map(
      (item) => `<div style="${row};align-items:baseline;gap:${em(16)};padding:${em(6)} 0;border-bottom:1px solid ${colors.line};break-inside:avoid">
        <div style="min-width:0">
          <span style="font-weight:500;color:${INK}">${esc(item.name)}</span>
          <span style="font-size:${em(12)};color:${SOFT};margin-left:${em(6)}">${esc(item.detail)}</span>
        </div>
        <div style="${money}">${esc(item.amount)}</div>
      </div>`,
    )
    .join('');

  const received = view.voided
    ? `<div style="${row};align-items:center;margin-top:${em(12)};padding:${em(11)} ${em(16)};border-radius:${em(6)};border:2px solid ${colors.danger};color:${colors.danger}">
         <div style="font-weight:700;font-size:${em(20)};letter-spacing:0.16em">VOID</div>
         <div style="${money};font-size:${em(24)};text-decoration:line-through">${esc(view.amount)}</div>
       </div>`
    : `<div style="${row};align-items:center;margin-top:${em(12)};padding:${em(11)} ${em(16)};border-radius:${em(6)};background:${colors.accentTint};color:${colors.accentInk}">
         <div>
           <div style="font-size:${em(12)}">Amount received</div>
           <div style="font-weight:700">${esc(view.kind)}</div>
         </div>
         <div style="${money};font-size:${em(28)};font-weight:700">${esc(view.amount)}</div>
       </div>`;

  const balance = view.paidInFull
    ? `<div style="border:2px solid ${colors.accent};border-radius:${em(4)};padding:${em(1)} ${em(10)};color:${colors.accent};font-size:${em(13)};letter-spacing:0.08em">PAID IN FULL</div>`
    : `<div style="${money};color:${colors.accent}">${esc(view.balance)}</div>`;

  const collection = view.collection
    ? `<div style="${row};padding-top:${em(4)}"><div>Collection</div><div style="font-weight:600">${esc(view.collection)}</div></div>`
    : '';

  const footer = view.footer
    ? `<div style="margin-top:auto;padding-top:${em(10)};border-top:1px dashed ${colors.line2};text-align:center;font-size:${em(12)};color:${SOFT}">${esc(view.footer)}</div>`
    : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A5; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
</head>
<body>
<div style="box-sizing:border-box;width:100%;min-height:${Math.floor(pageWidth * A5_RATIO)}px;padding:${em(36)} ${em(40)} ${em(28)};display:flex;flex-direction:column;background:#fff;color:${colors.text};font-family:${SANS};font-size:${base}px;line-height:1.45">
  <div style="display:flex;flex-direction:column;align-items:center;gap:${em(2)};text-align:center">
    ${logo}
    <div style="font-family:${SERIF};font-weight:700;font-size:${em(26)};line-height:1.15;color:${colors.accent}">${esc(view.shopName)}</div>
    <div style="font-size:${em(12)};color:${SOFT}">${esc(view.shopContact)}</div>
  </div>

  <div style="height:2px;background:${colors.accent};margin:${em(14)} 0 ${em(12)}"></div>

  <div style="${row};align-items:baseline">
    <div style="font-weight:700;font-size:${em(13)};letter-spacing:0.12em">RECEIPT</div>
    <div style="${money};font-weight:700;color:${colors.accent}">${esc(view.number)}</div>
  </div>
  <div style="font-size:${em(12)};color:${SOFT};text-align:right">${esc(view.date)}</div>

  <div style="display:flex;gap:${em(24)};margin-top:${em(6)}">
    <div style="flex:1;min-width:0">
      <div style="font-size:${em(12)};color:${SOFT}">Received from</div>
      <div style="font-size:${em(17)};font-weight:600;color:${INK}">${esc(view.client)}</div>
    </div>
    ${job}
  </div>

  <div style="${row};margin-top:${em(14)};padding-bottom:${em(5)};border-bottom:1px solid ${colors.text};font-size:${em(12)};font-weight:700;letter-spacing:0.04em">
    <div>Items</div><div>Amount</div>
  </div>
  ${items}
  <div style="${row};padding-top:${em(7)};font-weight:700;color:${INK}">
    <div>Total</div><div style="${money}">${esc(view.total)}</div>
  </div>

  ${received}

  <div style="${row};padding-top:${em(10)}">
    <div>Paid so far</div><div style="${money}">${esc(view.paid)}</div>
  </div>
  <div style="${row};align-items:center;padding-top:${em(4)};font-size:${em(17)};font-weight:700;color:${INK}">
    <div>Balance</div>
    ${balance}
  </div>
  ${collection}
  ${footer}
</div>
</body>
</html>`;
}
