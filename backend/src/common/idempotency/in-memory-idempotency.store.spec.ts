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

  it('stores and retrieves entries', () => {
    const store = new InMemoryIdempotencyStore();
    const entry = buildEntry(Date.now() + 1_000);

    store.set('user-1:key', entry);

    expect(store.get('user-1:key')).toEqual(entry);
  });

  it('returns undefined for unknown scopes', () => {
    const store = new InMemoryIdempotencyStore();

    expect(store.get('user-1:missing')).toBeUndefined();
  });

  it('evicts expired entries on read', () => {
    const store = new InMemoryIdempotencyStore();
    store.set('user-1:key', buildEntry(Date.now() + 1_000));

    jest.setSystemTime(Date.now() + 2_000);

    expect(store.get('user-1:key')).toBeUndefined();
  });

  it('evicts expired entries when setting a new one', () => {
    const store = new InMemoryIdempotencyStore();
    store.set('user-1:old', buildEntry(Date.now() + 1_000));

    jest.setSystemTime(Date.now() + 2_000);
    store.set('user-1:new', buildEntry(Date.now() + 1_000));

    expect(store.get('user-1:old')).toBeUndefined();
    expect(store.get('user-1:new')).toBeDefined();
  });
});
