/**
 * Native file IO for the image upload queue (sync-contract §8): read a local file's byte
 * size and PUT its bytes to a signed bucket URL. Split out of sync/images.ts so the web
 * build (imageUploadIo.web.ts) can read bytes from IndexedDB instead. Lazy-imports
 * expo-file-system so nothing native loads until an upload actually runs.
 */

export async function fileSize(localUri: string): Promise<number> {
  // expo-file-system v56: `File` implements Blob, so `.size` is the byte length.
  const { File } = await import('expo-file-system');
  return new File(localUri).size ?? 0;
}

export async function put(
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
