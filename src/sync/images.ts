import { Database, Q } from '@nozbe/watermelondb';
import { Tables } from '@/db/schema';
import ImageRecord from '@/db/models/ImageRecord';
import { images as imagesRepo } from '@/repositories';
import { notDeleted } from '@/repositories/softDelete';
import { config } from '@/lib/config';
import { getAccessToken } from '@/auth/supabase';
import { syncLog, syncWarn } from './logger';
import { SyncHttpError } from './types';

/**
 * Image upload queue (sync-contract §8). Binaries never ride the sync payload — they go
 * sign → PUT → sync-the-row, out-of-band. This runs **before** push (§12 step 2) so a
 * freshly-uploaded image row carries its `remote_url` on the next push. Attaching a photo
 * already wrote a `pending` row with a local file (data-model §5); here we drain pending
 * rows when online. Never blocks a measurement session — failures just mark the row
 * `failed` and are retried next cycle.
 */

export type SignRequest = { image_id: string; content_type: string; byte_size: number };
export type SignResponse = {
  method: 'PUT';
  url: string;
  headers: Record<string, string>;
  remote_url: string;
  expires_at: number;
};

/** Injectable boundary so the queue is unit-testable without native file IO / a network. */
export type ImageUploadDeps = {
  sign: (req: SignRequest, token: string) => Promise<SignResponse>;
  /** PUT the file bytes to the signed bucket URL; resolves with the HTTP status. */
  put: (url: string, localUri: string, headers: Record<string, string>) => Promise<number>;
  fileSize: (localUri: string) => Promise<number>;
  getToken?: () => Promise<string | null>;
};

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Guess an allowed content type from the file extension (server enforces the allow-list, §8). */
export function contentTypeForUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[ext] ?? 'image/jpeg';
}

export type ImageUploadResult = { uploaded: number; failed: number; skipped: boolean };

/**
 * Upload all `pending` image rows that still have a local file. Per row: sign → PUT bytes →
 * mark `uploaded` + store `remote_url`. The row then syncs normally on the next push, where
 * `remote_url` crosses the wire and `local_uri`/`upload_status` stay device-local (§11).
 */
export async function runImageUploads(
  database: Database,
  deps: ImageUploadDeps,
): Promise<ImageUploadResult> {
  const getToken = deps.getToken ?? getAccessToken;
  const token = await getToken();
  if (!token) return { uploaded: 0, failed: 0, skipped: true };

  const pending = await database
    .get<ImageRecord>(Tables.images)
    .query(Q.where('upload_status', 'pending'), notDeleted)
    .fetch();

  let uploaded = 0;
  let failed = 0;
  if (pending.length) syncLog('images — uploading', pending.length, 'pending');

  for (const image of pending) {
    if (!image.localUri) continue;
    try {
      await imagesRepo.markUploading(database, image.id);
      const byteSize = await deps.fileSize(image.localUri);
      const contentType = contentTypeForUri(image.localUri);
      const signed = await deps.sign(
        { image_id: image.id, content_type: contentType, byte_size: byteSize },
        token,
      );
      const status = await deps.put(signed.url, image.localUri, {
        'content-type': contentType,
        ...signed.headers,
      });
      if (status < 200 || status >= 300) {
        throw new SyncHttpError(status, `bucket PUT failed (${status})`);
      }
      await imagesRepo.markUploaded(database, image.id, signed.remote_url);
      uploaded += 1;
    } catch (e) {
      // Non-blocking: leave it for the next cycle.
      syncWarn('images — upload failed for', image.id, '—', e instanceof Error ? e.message : e);
      await imagesRepo.markFailed(database, image.id);
      failed += 1;
    }
  }

  return { uploaded, failed, skipped: false };
}

// ── Default (native) deps — expo-file-system for IO, our API for signing ────────────────
// Lazy-imported so importing this module never pulls in native modules (keeps it testable).

async function defaultSign(req: SignRequest, token: string): Promise<SignResponse> {
  const res = await fetch(`${config.backendBaseUrl}/uploads/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new SyncHttpError(res.status, `sign failed (${res.status})`);
  return (await res.json()) as SignResponse;
}

async function defaultFileSize(localUri: string): Promise<number> {
  // expo-file-system v56: `File` implements Blob, so `.size` is the byte length.
  const { File } = await import('expo-file-system');
  return new File(localUri).size ?? 0;
}

async function defaultPut(
  url: string,
  localUri: string,
  headers: Record<string, string>,
): Promise<number> {
  // v56 upload API: PUT the file bytes as-is (BINARY_CONTENT) to the signed bucket URL.
  const { File, UploadType } = await import('expo-file-system');
  const result = await new File(localUri).upload(url, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers,
    mimeType: headers['content-type'],
  });
  return result.status;
}

/** Read a signed GET url for a private-bucket image another device uploaded (§8 step 4). */
export async function getReadUrl(imageId: string, token: string): Promise<string> {
  const res = await fetch(
    `${config.backendBaseUrl}/uploads/url?image_id=${encodeURIComponent(imageId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new SyncHttpError(res.status, `read-url failed (${res.status})`);
  const body = (await res.json()) as { url: string };
  return body.url;
}

export const defaultImageUploadDeps: ImageUploadDeps = {
  sign: defaultSign,
  put: defaultPut,
  fileSize: defaultFileSize,
};
