import { colors } from '@/theme/tokens';

/**
 * What a receipt and an invoice share on paper: the A5 page, the shop's header and the
 * footer. Fonts are the system's, not the app's: this has to work offline, where a web
 * font can't load.
 *
 * Sizes are in `em` off a base set from the page width, so the one layout fits both the
 * native PDF (420 wide, 1px = 1pt) and the browser's print page (559 wide).
 */

export const INK = '#2F3132';
export const SOFT = '#6B675E';
const DESIGN_WIDTH = 559;
const DESIGN_FONT = 14;
const A5_RATIO = 210 / 148;

const SANS = 'Helvetica, Arial, sans-serif';
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = 'Menlo, Consolas, monospace';

export type PaperOptions = { logoSrc: string | null; pageWidth: number };

export const MONEY = `font-family:${MONO}`;
export const ROW = 'display:flex;justify-content:space-between';

/** A size from the design, in px at the design's 14px base. */
export const em = (px: number) => `${(px / DESIGN_FONT).toFixed(3)}em`;

export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Clear space between the last item and the total: about one item row's height. */
const TOTAL_GAP = 32;

/** The items table, total row included. */
export function itemsHtml(
  items: { name: string; detail: string; amount: string; pending?: boolean }[],
  total: string,
): string {
  const rows = items
    .map(
      (item) => `<div style="${ROW};align-items:baseline;gap:${em(16)};padding:${em(6)} 0;border-bottom:1px solid ${colors.line};break-inside:avoid">
        <div style="min-width:0">
          <span style="font-weight:500;color:${INK}">${esc(item.name)}</span>
          <span style="font-size:${em(12)};color:${SOFT};margin-left:${em(6)}">${esc(item.detail)}</span>
        </div>
        <div style="${item.pending ? `font-size:${em(12)};color:${SOFT}` : MONEY}">${esc(item.amount)}</div>
      </div>`,
    )
    .join('');

  return `<div style="${ROW};margin-top:${em(14)};padding-bottom:${em(5)};border-bottom:1px solid ${colors.text};font-size:${em(12)};font-weight:700;letter-spacing:0.04em">
    <div>Items</div><div>Amount</div>
  </div>
  ${rows}
  <div style="${ROW};margin-top:${em(TOTAL_GAP)};padding-top:${em(7)};font-weight:700;color:${INK}">
    <div>Total</div><div style="${MONEY}">${esc(total)}</div>
  </div>`;
}

/** The PAID IN FULL stamp. */
export function paidInFullHtml(): string {
  return `<div style="border:2px solid ${colors.accent};border-radius:${em(4)};padding:${em(1)} ${em(10)};color:${colors.accent};font-size:${em(13)};letter-spacing:0.08em">PAID IN FULL</div>`;
}

/** A whole A5 page: the shop's header, then `body`, then the footer pinned to the bottom. */
export function paperHtml(
  shop: { name: string; contact: string; footer: string },
  body: string,
  { logoSrc, pageWidth }: PaperOptions,
): string {
  const base = (pageWidth / DESIGN_WIDTH) * DESIGN_FONT;

  const logo = logoSrc
    ? `<img src="${esc(logoSrc)}" style="width:${em(60)};height:${em(60)};margin-bottom:${em(6)};border-radius:50%;object-fit:cover" />`
    : '';

  const footer = shop.footer
    ? `<div style="margin-top:auto;padding-top:${em(10)};border-top:1px dashed ${colors.line2};text-align:center;font-size:${em(12)};color:${SOFT}">${esc(shop.footer)}</div>`
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
    <div style="font-family:${SERIF};font-weight:700;font-size:${em(26)};line-height:1.15;color:${colors.accent}">${esc(shop.name)}</div>
    <div style="font-size:${em(12)};color:${SOFT}">${esc(shop.contact)}</div>
  </div>

  <div style="height:2px;background:${colors.accent};margin:${em(14)} 0 ${em(12)}"></div>

  ${body}
  ${footer}
</div>
</body>
</html>`;
}

/**
 * "Received from" / "Bill to" on the left, with the client's phone when there is one, and the
 * job on the right when it has a title.
 */
export function partiesHtml(label: string, client: string, job: string | null, phone: string | null = null): string {
  const jobBlock = job
    ? `<div style="flex:1;min-width:0;text-align:right">
         <div style="font-size:${em(12)};color:${SOFT}">Job</div>
         <div style="font-weight:500">${esc(job)}</div>
       </div>`
    : '';
  return `<div style="display:flex;gap:${em(24)};margin-top:${em(6)}">
    <div style="flex:1;min-width:0">
      <div style="font-size:${em(12)};color:${SOFT}">${esc(label)}</div>
      <div style="font-size:${em(17)};font-weight:600;color:${INK}">${esc(client)}</div>
      ${phone ? `<div style="font-size:${em(12)};color:${SOFT}">${esc(phone)}</div>` : ''}
    </div>
    ${jobBlock}
  </div>`;
}
