import { useEffect, useState } from 'react';
import { isImageStoreUri, objectUrlFor } from './imageStore.web';

/**
 * Web resolver for an image row's `local_uri`. A `blob:`/`http` URI renders as-is, but our
 * durable `idb-image://` scheme must be turned into an object URL from the IndexedDB bytes
 * (see imageStore.web.ts). Returns undefined until resolved, and revokes the object URL on
 * unmount / uri change so we don't leak. Mirrors the native imageSrc.ts passthrough hook.
 */
export function useImageSrc(uri: string): string | undefined {
  const [src, setSrc] = useState<string | undefined>(() =>
    isImageStoreUri(uri) ? undefined : uri,
  );

  useEffect(() => {
    if (!isImageStoreUri(uri)) {
      setSrc(uri);
      return;
    }
    let alive = true;
    let created: string | undefined;
    objectUrlFor(uri).then((url) => {
      if (!alive) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      created = url ?? undefined;
      setSrc(created);
    });
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [uri]);

  return src;
}
