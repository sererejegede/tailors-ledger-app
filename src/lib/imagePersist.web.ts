import { putBlob } from './imageStore.web';

/**
 * Web persist for a picked image. expo-image-picker's web build returns an ephemeral
 * `blob:` object URL (dies on reload); we fetch its bytes and store them durably in
 * IndexedDB, returning the stable `idb-image://<id>` URI for the `images` row. Mirrors the
 * native imagePersist.ts contract (async, returns a URI the display + upload seams read).
 */
export async function persistImage(srcUri: string): Promise<string> {
  const blob = await fetch(srcUri).then((r) => r.blob());
  const uri = await putBlob(blob);
  // The picker's object URL is no longer needed once bytes are copied into the store.
  try {
    URL.revokeObjectURL(srcUri);
  } catch {
    // Not an object URL (or already revoked) — nothing to clean up.
  }
  return uri;
}
