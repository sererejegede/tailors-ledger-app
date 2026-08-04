import * as ImagePicker from 'expo-image-picker';
import { persistImage } from './imagePersist';

/**
 * Camera/gallery capture for set images (spec §8). The picker returns a temp uri; we
 * persist it durably and hand back a stable local uri for the `images` row. Persistence is
 * platform-split: native copies into the app's document directory (imagePersist.ts); web
 * stores the bytes in IndexedDB (imagePersist.web.ts). expo-image-picker itself works on
 * both — its web build is a file input that grants permissions as a no-op and returns the
 * chosen File. Bytes never touch the DB; upload is the sync image queue.
 */
export type PickedImage = { localUri: string; width?: number; height?: number };

async function take(
  launch: () => Promise<ImagePicker.ImagePickerResult>,
): Promise<PickedImage | null> {
  const res = await launch();
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return { localUri: await persistImage(a.uri), width: a.width, height: a.height };
}

/**
 * Pick one or more photos from the library at once. `limit` caps the selection (the caller
 * passes the set's remaining slots). Returns [] if denied or cancelled.
 */
export async function pickManyFromGallery(limit?: number): Promise<PickedImage[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsMultipleSelection: true,
    selectionLimit: limit, // 0/undefined = unlimited on native; the caller always passes a cap
  });
  if (res.canceled || !res.assets?.length) return [];
  return Promise.all(
    res.assets.map(async (a) => ({
      localUri: await persistImage(a.uri),
      width: a.width,
      height: a.height,
    })),
  );
}

/** Capture with the camera. Returns null if denied or cancelled. */
export async function captureFromCamera(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  return take(() => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 }));
}
