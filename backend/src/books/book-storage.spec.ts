import { AiErrorException } from '../common/errors/ai-error.exception';
import type { SupabaseService } from '../supabase/supabase.service';
import { DisabledBookStorage } from './disabled-book.storage';
import { SupabaseBookStorage } from './supabase-book.storage';

function buildStorage(options: { hasClient?: boolean; error?: unknown } = {}) {
  const upload = jest
    .fn()
    .mockResolvedValue({ data: { path: 'p' }, error: options.error ?? null });
  const createSignedUrl = jest.fn().mockResolvedValue({
    data: options.error ? null : { signedUrl: 'https://signed.example/p' },
    error: options.error ?? null,
  });
  const from = jest.fn(() => ({ upload, createSignedUrl }));
  const client = { storage: { from } };
  const supabaseService = {
    getClient: () => (options.hasClient === false ? null : client),
  } as unknown as SupabaseService;

  return {
    storage: new SupabaseBookStorage(supabaseService, 'book-images'),
    from,
    upload,
    createSignedUrl,
  };
}

describe('SupabaseBookStorage', () => {
  it('uploads objects to the configured bucket', async () => {
    const { storage, from, upload } = buildStorage();
    const data = Buffer.from('image');

    await storage.upload('users/u/jobs/j/page-1.png', data, 'image/png');

    expect(from).toHaveBeenCalledWith('book-images');
    expect(upload).toHaveBeenCalledWith('users/u/jobs/j/page-1.png', data, {
      contentType: 'image/png',
      upsert: true,
    });
  });

  it('mints signed URLs with the requested TTL', async () => {
    const { storage, createSignedUrl } = buildStorage();

    await expect(
      storage.signedUrl('users/u/jobs/j/page-1.png', 60),
    ).resolves.toBe('https://signed.example/p');
    expect(createSignedUrl).toHaveBeenCalledWith(
      'users/u/jobs/j/page-1.png',
      60,
    );
  });

  it('fails with 503 on upload errors', async () => {
    const { storage } = buildStorage({ error: new Error('nope') });

    await expect(
      storage.upload('path', Buffer.from('x'), 'image/png'),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });

  it('fails with 503 when Supabase is not configured', async () => {
    const { storage } = buildStorage({ hasClient: false });

    const error = await storage
      .signedUrl('path', 60)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiErrorException);
    expect((error as AiErrorException).getStatus()).toBe(503);
  });
});

describe('DisabledBookStorage', () => {
  const storage = new DisabledBookStorage();

  it('rejects uploads and signed URLs with a clear error', async () => {
    await expect(
      storage.upload('path', Buffer.from('x'), 'image/png'),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    await expect(storage.signedUrl('path', 60)).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
  });
});
