jest.mock('@/lib/config', () => ({
  config: { backendBaseUrl: 'http://mock.test/v1', supabaseUrl: '', supabaseAnonKey: '' },
  isBackendConfigured: true,
  isSupabaseConfigured: false,
}));
jest.mock('@/auth/supabase', () => ({ getAccessToken: jest.fn(async () => 'mock-token') }));

import { Database } from '@nozbe/watermelondb';
import { makeTestDatabase } from '@/db/testDatabase';
import { ensureSeeded } from '@/db/seed';
import { Tables } from '@/db/schema';
import { createClient } from '@/repositories/clients';
import { createSetWithMeasurements } from '@/repositories/sets';
import { createImage, imagesForSet, markUploaded } from '@/repositories/images';
import Template from '@/db/models/Template';
import { runImageUploads, contentTypeForUri, type ImageUploadDeps } from '../images';

async function makeSetWithImage(db: Database, localUri = 'file:///photos/card.jpg') {
  const client = await createClient(db, { name: 'Tunde Bello' });
  const templates = await db.get<Template>(Tables.templates).query().fetch();
  const template = templates.find((t) => t.isDefault)!;
  const set = await createSetWithMeasurements(db, {
    clientId: client.id,
    templateId: template.id,
    items: [],
  });
  const image = await createImage(db, set.id, { kind: 'card', localUri });
  return { set, image };
}

describe('contentTypeForUri', () => {
  it('maps known extensions and defaults to jpeg', () => {
    expect(contentTypeForUri('a/b.png')).toBe('image/png');
    expect(contentTypeForUri('a/b.JPG')).toBe('image/jpeg');
    expect(contentTypeForUri('a/b.webp')).toBe('image/webp');
    expect(contentTypeForUri('a/b.heic')).toBe('image/jpeg');
  });
});

describe('runImageUploads — sign → PUT → mark uploaded', () => {
  it('uploads a pending image and stores the remote_url', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const { set, image } = await makeSetWithImage(db);

    const sign = jest.fn(async (req) => ({
      method: 'PUT' as const,
      url: `https://bucket.test/put/${req.image_id}`,
      headers: { 'x-amz-acl': 'private' },
      remote_url: `https://cdn.test/${req.image_id}.jpg`,
      expires_at: 0,
    }));
    const put = jest.fn(async () => 200);
    const fileSize = jest.fn(async () => 824133);
    const deps: ImageUploadDeps = { sign, put, fileSize, getToken: async () => 'tok' };

    const result = await runImageUploads(db, deps);

    expect(result).toEqual({ uploaded: 1, failed: 0, skipped: false });
    expect(sign).toHaveBeenCalledWith(
      { image_id: image.id, content_type: 'image/jpeg', byte_size: 824133 },
      'tok',
    );
    // PUT carried the signed url + content type.
    expect(put).toHaveBeenCalledWith(
      `https://bucket.test/put/${image.id}`,
      'file:///photos/card.jpg',
      expect.objectContaining({ 'content-type': 'image/jpeg', 'x-amz-acl': 'private' }),
    );

    const [reloaded] = await imagesForSet(db, set.id);
    expect(reloaded.uploadStatus).toBe('uploaded');
    expect(reloaded.remoteUrl).toBe(`https://cdn.test/${image.id}.jpg`);
  });

  it('marks the row failed (not uploaded) when the PUT fails — non-blocking', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const { set } = await makeSetWithImage(db);

    const deps: ImageUploadDeps = {
      sign: async (req) => ({
        method: 'PUT',
        url: 'https://bucket.test/put',
        headers: {},
        remote_url: `https://cdn.test/${req.image_id}.jpg`,
        expires_at: 0,
      }),
      put: async () => 500, // bucket rejects
      fileSize: async () => 10,
      getToken: async () => 'tok',
    };

    const result = await runImageUploads(db, deps);
    expect(result).toEqual({ uploaded: 0, failed: 1, skipped: false });

    const [reloaded] = await imagesForSet(db, set.id);
    expect(reloaded.uploadStatus).toBe('failed');
    expect(reloaded.remoteUrl).toBeFalsy();
  });

  it('skips an already-uploaded image (only drains pending rows)', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    const { image } = await makeSetWithImage(db);
    // Mark it uploaded out of band.
    await markUploaded(db, image.id, 'https://cdn.test/x.jpg');

    const sign = jest.fn();
    const result = await runImageUploads(db, {
      sign: sign as never,
      put: async () => 200,
      fileSize: async () => 1,
      getToken: async () => 'tok',
    });

    expect(sign).not.toHaveBeenCalled();
    expect(result.uploaded).toBe(0);
  });

  it('no-ops when signed out', async () => {
    const db = makeTestDatabase();
    await ensureSeeded(db);
    await makeSetWithImage(db);
    const result = await runImageUploads(db, {
      sign: async () => {
        throw new Error('should not sign');
      },
      put: async () => 200,
      fileSize: async () => 1,
      getToken: async () => null,
    });
    expect(result).toEqual({ uploaded: 0, failed: 0, skipped: true });
  });
});
