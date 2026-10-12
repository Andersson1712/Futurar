import { InMemoryIdempotencyStore } from './in-memory-idempotency.store';
import { StoredIdempotentResponse } from './idempotency-store';

const buildEntry = (expiresAt: number): StoredIdempotentResponse => ({
  statusCode: 202,
  body: { jobId: 'job-1' },
  requestHash: 'hash-1',
  expiresAt,
});

describe('InMemoryIdempotencyStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores and retrieves entries', async () => {
    const store = new InMemoryIdempotencyStore();
    const entry = buildEntry(Date.now() + 1_000);

    await store.set('user-1:key', entry);

    await expect(store.get('user-1:key')).resolves.toEqual(entry);
  });

  it('returns undefined for unknown scopes', async () => {
    const store = new InMemoryIdempotencyStore();

    await expect(store.get('user-1:missing')).resolves.toBeUndefined();
  });

  it('evicts expired entries on read', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.set('user-1:key', buildEntry(Date.now() + 1_000));

    jest.setSystemTime(Date.now() + 2_000);

    await expect(store.get('user-1:key')).resolves.toBeUndefined();
  });

  it('evicts expired entries when setting a new one', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.set('user-1:old', buildEntry(Date.now() + 1_000));

    jest.setSystemTime(Date.now() + 2_000);
    await store.set('user-1:new', buildEntry(Date.now() + 1_000));

    await expect(store.get('user-1:old')).resolves.toBeUndefined();
    await expect(store.get('user-1:new')).resolves.toBeDefined();
  });
});
