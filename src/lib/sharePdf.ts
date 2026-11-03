import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import type { InvoiceView } from './invoice';
import { invoiceHtml } from './invoiceHtml';
import type { PaperOptions } from './paperHtml';
import type { ReceiptView } from './receipt';
import { receiptHtml } from './receiptHtml';

// A5 at the 72 PPI expo-print works in.
const PAGE = { width: 420, height: 595 };

const MIME_BY_EXT: Record<string, string> = { png: 'image/png', webp: 'image/webp' };

/**
 * iOS can't load a local image while printing HTML, so the logo goes in as data. A logo
 * that can't be read never stops the page going out: it just prints without one.
 */
async function logoDataUri(uri: string | undefined): Promise<string | null> {
  if (!uri) return null;
  try {
    const ext = uri.split('.').pop()?.toLowerCase() ?? '';
    return `data:${MIME_BY_EXT[ext] ?? 'image/jpeg'};base64,${await new File(uri).base64()}`;
  } catch {
    return null;
  }
}

/** Make the PDF and open the phone's share sheet, where the tailor picks WhatsApp. */
async function sharePdf(render: (opts: PaperOptions) => string, name: string, logoUri?: string): Promise<void> {
  const html = render({ logoSrc: await logoDataUri(logoUri), pageWidth: PAGE.width });
  const { uri } = await Print.printToFileAsync({ html, ...PAGE });

  // expo-print picks a random name; this is what the client sees in the chat.
  const named = new File(Paths.cache, `${name}.pdf`);
  new File(uri).move(named, { overwrite: true });

  await Sharing.shareAsync(named.uri, {
    UTI: '.pdf',
    mimeType: 'application/pdf',
    dialogTitle: `Share ${name.charAt(0).toLowerCase()}${name.slice(1)}`,
  });
}

export function shareReceipt(view: ReceiptView, logoUri?: string): Promise<void> {
  return sharePdf((opts) => receiptHtml(view, opts), `Receipt ${view.number}`, logoUri);
}

export function shareInvoice(view: InvoiceView, logoUri?: string): Promise<void> {
  return sharePdf((opts) => invoiceHtml(view, opts), `Invoice ${view.date}`, logoUri);
}
