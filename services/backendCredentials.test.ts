import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw/server';
import {
  listCredentials,
  revokeCredential,
  saveCredential,
} from './backendCredentials';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'token-1' } },
      }),
      refreshSession: vi.fn(),
    },
  },
}));

const API_KEY = 'AIzaSyTestKey1234567890abcdefg';

describe('backendCredentials (SPEC-020)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists credential metadata', async () => {
    await expect(listCredentials()).resolves.toEqual([]);
  });

  it('saves a key and returns metadata without the key', async () => {
    const metadata = await saveCredential('gemini', API_KEY);

    expect(metadata).toMatchObject({ provider: 'gemini', keyHint: 'defg' });
    expect(JSON.stringify(metadata)).not.toContain(API_KEY);
  });

  it('revokes the credential', async () => {
    await expect(revokeCredential('gemini')).resolves.toBeUndefined();
  });
});
