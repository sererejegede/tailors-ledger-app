/**
 * Resolve an image row's `local_uri` to a URI RN's `<Image>` can render. On native the
 * stored `file://` path renders directly, so this is a passthrough. The web build
 * (imageSrc.web.ts) resolves the `idb-image://` scheme to an object URL. Kept as a hook so
 * both platforms share one call site in components.
 */
export function useImageSrc(uri: string): string | undefined {
  return uri;
}
