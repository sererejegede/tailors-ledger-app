import { getBlob } from './imageStore.web';
import type { InvoiceView } from './invoice';
import { invoiceHtml } from './invoiceHtml';
import type { PaperOptions } from './paperHtml';
import type { ReceiptView } from './receipt';
import { receiptHtml } from './receiptHtml';

// A5 at the browser's 96 PPI.
const PAGE_WIDTH = 559;
const CLEANUP_MS = 60_000;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function logoDataUri(uri: string | undefined): Promise<string | null> {
  if (!uri) return null;
  try {
    const blob = await getBlob(uri);
    return blob ? await readAsDataUrl(blob) : null;
  } catch {
    return null;
  }
}

/**
 * The web can't share a local PDF (Web Share needs a hosted file) and expo-print can only
 * print the current page, so this prints the page from a hidden frame. The browser's
 * print dialog offers "Save as PDF".
 */
async function sharePdf(render: (opts: PaperOptions) => string, name: string, logoUri?: string): Promise<void> {
  const frame = document.createElement('iframe');
  frame.title = name;
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
  frame.srcdoc = render({ logoSrc: await logoDataUri(logoUri), pageWidth: PAGE_WIDTH });
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), CLEANUP_MS);
  };
  document.body.appendChild(frame);
}

export function shareReceipt(view: ReceiptView, logoUri?: string): Promise<void> {
  return sharePdf((opts) => receiptHtml(view, opts), `Receipt ${view.number}`, logoUri);
}

export function shareInvoice(view: InvoiceView, logoUri?: string): Promise<void> {
  return sharePdf((opts) => invoiceHtml(view, opts), `Invoice ${view.date}`, logoUri);
}
