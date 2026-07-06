import { newId } from './ids';

/**
 * Durable image-byte store for the web (PWA) build.
 *
 * On native, an image's `local_uri` is a `file://` path that survives app restarts and
 * `<Image>` renders directly. The browser has neither: the picker hands back an ephemeral
 * `blob:` object URL that dies on reload, and RN-web `<Image>` can't read a filesystem
 * path. So on web we persist the raw bytes in a dedicated IndexedDB object store and mint a
 * stable custom-scheme URI, `idb-image://<id>`, which the persist, display, and upload
 * seams all understand. This is separate from WatermelonDB's own Loki/IndexedDB database —
 * bytes never live in a DB row (data-model §5 / contract §11).
 */

const SCHEME = 'idb-image://';
const DB_NAME = 'tailors_ledger_images';
const STORE = 'blobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/** True if a `local_uri` points at the web blob store rather than a native file. */
export function isImageStoreUri(uri: string): boolean {
  return uri.startsWith(SCHEME);
}

function idFromUri(uri: string): string {
  return uri.slice(SCHEME.length);
}

/** Store bytes and return the stable `idb-image://<id>` URI to save on the images row. */
export async function putBlob(blob: Blob): Promise<string> {
  const id = newId();
  await tx('readwrite', (store) => store.put(blob, id));
  return SCHEME + id;
}

/** Read the bytes behind an `idb-image://` URI, or null if missing/not a store URI. */
export async function getBlob(uri: string): Promise<Blob | null> {
  if (!isImageStoreUri(uri)) return null;
  const blob = await tx<Blob | undefined>('readonly', (store) => store.get(idFromUri(uri)));
  return blob ?? null;
}

/** Drop stored bytes (used when hard-purging; soft delete leaves them, mirroring native). */
export async function deleteBlob(uri: string): Promise<void> {
  if (!isImageStoreUri(uri)) return;
  await tx('readwrite', (store) => store.delete(idFromUri(uri)));
}

/** Resolve an `idb-image://` URI to a renderable object URL; caller revokes it. */
export async function objectUrlFor(uri: string): Promise<string | null> {
  const blob = await getBlob(uri);
  return blob ? URL.createObjectURL(blob) : null;
}
