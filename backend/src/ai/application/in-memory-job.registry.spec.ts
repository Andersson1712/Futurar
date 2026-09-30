import { InMemoryJobRegistry, JOB_TTL_MS } from './in-memory-job.registry';

describe('InMemoryJobRegistry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates queued jobs scoped per user', () => {
    const registry = new InMemoryJobRegistry();
    const job = registry.create('user-1');

    expect(job.status).toBe('queued');
    expect(registry.find(job.id, 'user-1')?.id).toBe(job.id);
    expect(registry.find(job.id, 'user-2')).toBeUndefined();
  });

  it('completes jobs with the validated book', () => {
    const registry = new InMemoryJobRegistry();
    const job = registry.create('user-1');

    registry.complete(job.id, {
      title: 'Cuento',
      totalPages: 1,
      pages: [{ pageNumber: 1, content: 'Había una vez' }],
    });

    const stored = registry.find(job.id, 'user-1');
    expect(stored?.status).toBe('completed');
    expect(stored?.book?.title).toBe('Cuento');
  });

  it('fails jobs with an error payload', () => {
    const registry = new InMemoryJobRegistry();
    const job = registry.create('user-1');

    registry.fail(job.id, {
      statusCode: 502,
      code: 'INVALID_OUTPUT',
      message: 'bad output',
    });

    const stored = registry.find(job.id, 'user-1');
    expect(stored?.status).toBe('failed');
    expect(stored?.error?.code).toBe('INVALID_OUTPUT');
  });

  it('expires jobs after the TTL', () => {
    const registry = new InMemoryJobRegistry();
    const job = registry.create('user-1');

    jest.setSystemTime(Date.now() + JOB_TTL_MS + 1);

    expect(registry.find(job.id, 'user-1')).toBeUndefined();
  });

  it('returns undefined for unknown jobs and no-ops on unknown updates', () => {
    const registry = new InMemoryJobRegistry();

    expect(registry.find('missing', 'user-1')).toBeUndefined();
    expect(() =>
      registry.complete('missing', {
        title: 'x',
        totalPages: 1,
        pages: [{ pageNumber: 1, content: 'x' }],
      }),
    ).not.toThrow();
    expect(() =>
      registry.fail('missing', {
        statusCode: 500,
        code: 'INTERNAL',
        message: 'x',
      }),
    ).not.toThrow();
  });
});
