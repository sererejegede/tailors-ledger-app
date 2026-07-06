import { getBlob, isImageStoreUri } from './imageStore.web';

/**
 * Web file IO for the image upload queue (sync-contract §8). Bytes live in IndexedDB under
 * an `idb-image://` uri (imageStore.web.ts), so size is the stored Blob's size and the PUT
 * sends that Blob directly with fetch. Falls back to fetching a plain uri (e.g. a lingering
 * object URL) so it degrades gracefully. Mirrors the native imageUploadIo.ts contract.
 */

async function blobFor(localUri: string): Promise<Blob | null> {
  if (isImageStoreUri(localUri)) return getBlob(localUri);
  return fetch(localUri).then((r) => r.blob());
}

export async function fileSize(localUri: string): Promise<number> {
  const blob = await blobFor(localUri);
  return blob?.size ?? 0;
}

export async function put(
  url: string,
  localUri: string,
  headers: Record<string, string>,
): Promise<number> {
  const blob = await blobFor(localUri);
  if (!blob) return 0;
  const res = await fetch(url, { method: 'PUT', headers, body: blob });
  return res.status;
}
