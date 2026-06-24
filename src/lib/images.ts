import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Camera/gallery capture for set images (spec §8). The picker returns a temp uri; we copy
 * it into the app's document directory so the file survives, and hand back a stable local
 * uri for the `images` row. Bytes never touch the DB; upload is Phase 4.
 */
export type PickedImage = { localUri: string; width?: number; height?: number };

function persist(srcUri: string): string {
  const dir = new Directory(Paths.document, 'set-images');
  if (!dir.exists) dir.create({ intermediates: true });
  const ext = srcUri.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const dest = new File(dir, name);
  new File(srcUri).copy(dest);
  return dest.uri;
}

async function take(
  launch: () => Promise<ImagePicker.ImagePickerResult>,
): Promise<PickedImage | null> {
  const res = await launch();
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return { localUri: persist(a.uri), width: a.width, height: a.height };
}

/** Pick from the photo library. Returns null if denied or cancelled. */
export async function pickFromGallery(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  return take(() =>
    ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 }),
  );
}

/** Capture with the camera. Returns null if denied or cancelled. */
export async function captureFromCamera(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  return take(() => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 }));
}
