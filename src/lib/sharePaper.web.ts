import html2canvas from 'html2canvas';
import { getBlob } from './imageStore.web';
import type { InvoiceView } from './invoice';
import { invoiceHtml } from './invoiceHtml';
import type { PaperOptions } from './paperHtml';
import type { ReceiptView } from './receipt';
import { receiptHtml } from './receiptHtml';

/**
 * On the web a receipt or invoice goes out as a PNG, not a PDF: making a PDF in the browser
 * needs a PDF library, which would add more to the PWA's download than this does. The
 * phone app still shares a PDF (sharePaper.ts).
 */

// The page drawn at the browser's 96 PPI (A5's width), then doubled so the text stays
// sharp when the client zooms in. Fixed, not the screen's pixel ratio, so a 3x phone
// doesn't make a file twice the size.
const PAGE_WIDTH = 559;
const SCALE = 2;

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
 * Lays the page out in a frame off screen (its own document, so the app's styles can't
 * reach it) and draws it to a PNG. The frame's load waits for the logo.
 */
async function drawImage(render: (opts: PaperOptions) => string, name: string, logoUri?: string): Promise<File> {
  const html = render({ logoSrc: await logoDataUri(logoUri), pageWidth: PAGE_WIDTH });
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_WIDTH}px;height:800px;border:0`;
  try {
    await new Promise<void>((resolve) => {
      frame.onload = () => resolve();
      frame.srcdoc = html;
      document.body.appendChild(frame);
    });
    const page = frame.contentDocument?.body.firstElementChild as HTMLElement | null | undefined;
    if (!page) throw new Error('The page did not load.');
    const height = Math.ceil(page.getBoundingClientRect().height);
    frame.style.height = `${height}px`;
    const canvas = await html2canvas(page, {
      scale: SCALE,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: PAGE_WIDTH,
      windowHeight: height,
    });
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The image could not be made.');
    return new File([blob], `${name}.png`, { type: 'image/png' });
  } finally {
    frame.remove();
  }
}

/**
 * The last image drawn. The browser only lets a page open the share sheet straight after a
 * tap (Safari is strict about it), so the screen draws the image when it opens and *Share*
 * finds it ready.
 */
let last: { key: string; file: Promise<File> } | null = null;

function imageFor(key: string, draw: () => Promise<File>): Promise<File> {
  if (last?.key === key) return last.file;
  const file = draw();
  const entry = { key, file };
  last = entry;
  file.catch(() => {
    if (last === entry) last = null;
  });
  return file;
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Opens the share sheet with the image, where the tailor picks WhatsApp. A browser that
 * can't share files (most desktop ones) downloads it instead.
 */
async function shareImage(file: Promise<File>): Promise<void> {
  const image = await file;
  if (!navigator.canShare?.({ files: [image] })) {
    download(image);
    return;
  }
  try {
    await navigator.share({ files: [image] });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    // Closing the share sheet isn't a failure.
    if (name === 'AbortError') return;
    // The tap was too long ago to open the sheet (the image wasn't ready yet).
    if (name === 'NotAllowedError') {
      download(image);
      return;
    }
    throw e;
  }
}

function receiptImage(view: ReceiptView, logoUri?: string): Promise<File> {
  const name = `Receipt ${view.number}`;
  return imageFor(`${name}|${logoUri ?? ''}|${JSON.stringify(view)}`, () =>
    drawImage((opts) => receiptHtml(view, opts), name, logoUri),
  );
}

function invoiceImage(view: InvoiceView, logoUri?: string): Promise<File> {
  const name = `Invoice ${view.date}`;
  return imageFor(`${name}|${logoUri ?? ''}|${JSON.stringify(view)}`, () =>
    drawImage((opts) => invoiceHtml(view, opts), name, logoUri),
  );
}

/** Draws the receipt ahead of the tap. A failure here is left for *Share* to report. */
export function prepareReceipt(view: ReceiptView, logoUri?: string): void {
  receiptImage(view, logoUri).catch(() => {});
}

export function prepareInvoice(view: InvoiceView, logoUri?: string): void {
  invoiceImage(view, logoUri).catch(() => {});
}

export function shareReceipt(view: ReceiptView, logoUri?: string): Promise<void> {
  return shareImage(receiptImage(view, logoUri));
}

export function shareInvoice(view: InvoiceView, logoUri?: string): Promise<void> {
  return shareImage(invoiceImage(view, logoUri));
}
