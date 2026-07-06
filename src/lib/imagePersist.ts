import { Directory, File, Paths } from 'expo-file-system';

/**
 * Native persist for a picked image: copy the picker's temp file into the app's document
 * directory so it survives, and return a stable `file://` URI for the `images` row. The
 * web build swaps this for imagePersist.web.ts (IndexedDB bytes). Bytes never touch the DB.
 */
export async function persistImage(srcUri: string): Promise<string> {
  const dir = new Directory(Paths.document, 'set-images');
  if (!dir.exists) dir.create({ intermediates: true });
  const ext = srcUri.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const dest = new File(dir, name);
  new File(srcUri).copy(dest);
  return dest.uri;
}
