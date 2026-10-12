import type { Redis } from 'ioredis';
import {
  IDEMPOTENCY_KEY_PREFIX,
  RedisIdempotencyStore,
} from './redis-idempotency.store';
import type { StoredIdempotentResponse } from './idempotency-store';

function buildStore() {
  const get = jest.fn();
  const set = jest.fn().mockResolvedValue('OK');
  const redis = { get, set } as unknown as Redis;

  return { store: new RedisIdempotencyStore(redis), get, set };
}

function buildEntry(expiresAt: number): StoredIdempotentResponse {
  return {
    statusCode: 202,
    body: { jobId: 'job-1' },
    requestHash: 'hash',
    expiresAt,
  };
}

describe('RedisIdempotencyStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads and parses stored entries', async () => {
    const { store, get } = buildStore();
    const entry = buildEntry(Date.now() + 60_000);
    get.mockResolvedValue(JSON.stringify(entry));

    await expect(store.get('user-1:key')).resolves.toEqual(entry);
    expect(get).toHaveBeenCalledWith(`${IDEMPOTENCY_KEY_PREFIX}user-1:key`);
  });

  it('returns undefined for missing entries', async () => {
    const { store, get } = buildStore();
    get.mockResolvedValue(null);

    await expect(store.get('user-1:key')).resolves.toBeUndefined();
  });

  it('writes entries with the remaining TTL in milliseconds', async () => {
    const { store, set } = buildStore();
    const entry = buildEntry(Date.now() + 60_000);

    await store.set('user-1:key', entry);

    expect(set).toHaveBeenCalledWith(
      `${IDEMPOTENCY_KEY_PREFIX}user-1:key`,
      JSON.stringify(entry),
      'PX',
      60_000,
    );
  });

  it('skips already expired entries', async () => {
    const { store, set } = buildStore();

    await store.set('user-1:key', buildEntry(Date.now() - 1));

    expect(set).not.toHaveBeenCalled();
  });
});
