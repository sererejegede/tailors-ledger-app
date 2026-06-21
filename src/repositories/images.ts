import { Database, Q } from '@nozbe/watermelondb';
import { Tables } from '@/db/schema';
import ImageRecord from '@/db/models/ImageRecord';
import { notDeleted, softDeleteById } from './softDelete';

/**
 * Image-metadata repository. Bytes live on the device filesystem and upload out-of-band
 * (contract §8) — this only tracks the row + `upload_status`. Attaching a photo writes a
 * `pending` row immediately so the thumbnail shows with no network (data-model §5). The
 * actual sign→PUT→sync upload queue is Phase 4.
 */

export type ImageKind = 'card' | 'camera' | 'gallery';
export type UploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export type NewImage = {
  kind: ImageKind;
  localUri: string;
  width?: number;
  height?: number;
};

export async function createImage(
  database: Database,
  setId: string,
  input: NewImage,
): Promise<ImageRecord> {
  return database.write(() =>
    database.get<ImageRecord>(Tables.images).create((img) => {
      img.set!.id = setId;
      img.kind = input.kind;
      img.localUri = input.localUri;
      img.uploadStatus = 'pending';
      img.width = input.width;
      img.height = input.height;
    }),
  );
}

async function setUploadStatus(
  database: Database,
  id: string,
  status: UploadStatus,
  remoteUrl?: string,
): Promise<ImageRecord> {
  const image = await database.get<ImageRecord>(Tables.images).find(id);
  await database.write(async () => {
    await image.update((img) => {
      img.uploadStatus = status;
      if (remoteUrl !== undefined) img.remoteUrl = remoteUrl;
    });
  });
  return image;
}

export async function markUploading(database: Database, id: string): Promise<ImageRecord> {
  return setUploadStatus(database, id, 'uploading');
}

export async function markUploaded(
  database: Database,
  id: string,
  remoteUrl: string,
): Promise<ImageRecord> {
  return setUploadStatus(database, id, 'uploaded', remoteUrl);
}

export async function markFailed(database: Database, id: string): Promise<ImageRecord> {
  return setUploadStatus(database, id, 'failed');
}

export async function softDeleteImage(database: Database, id: string): Promise<void> {
  await softDeleteById<ImageRecord>(database, Tables.images, id);
}

/** A set's images (newest first), excluding tombstones. */
export async function imagesForSet(
  database: Database,
  setId: string,
): Promise<ImageRecord[]> {
  return database
    .get<ImageRecord>(Tables.images)
    .query(Q.where('set_id', setId), notDeleted, Q.sortBy('created_at', Q.desc))
    .fetch();
}
