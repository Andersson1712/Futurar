import { InMemoryJobRepository, JOB_TTL_MS } from './in-memory-job.repository';
import type { GenerateBookRequestDto } from '../ai/dto/generate-book-request.dto';

const REQUEST: GenerateBookRequestDto = {
  protagonist: 'Un dragón',
  scenery: 'Un bosque',
  mission: 'Encontrar la estrella',
  style: 'Acuarela',
  storySize: 'small',
};

const BOOK = {
  title: 'Cuento',
  totalPages: 1,
  pages: [{ pageNumber: 1, content: 'Había una vez' }],
};

describe('InMemoryJobRepository', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates queued jobs scoped per user', async () => {
    const repository = new InMemoryJobRepository();
    const job = await repository.create({ userId: 'user-1', request: REQUEST });

    expect(job.status).toBe('queued');
    expect(job.request).toEqual(REQUEST);

    await expect(repository.find(job.id, 'user-1')).resolves.toMatchObject({
      id: job.id,
    });
    await expect(repository.findById(job.id)).resolves.toBeDefined();
    await expect(repository.find(job.id, 'user-2')).resolves.toBeUndefined();
  });

  it('updates status through markProcessing, complete and fail', async () => {
    const repository = new InMemoryJobRepository();
    const job = await repository.create({ userId: 'user-1', request: REQUEST });

    await repository.markProcessing(job.id);
    await expect(repository.findById(job.id)).resolves.toMatchObject({
      status: 'processing',
    });

    await repository.complete(job.id, BOOK);
    await expect(repository.findById(job.id)).resolves.toMatchObject({
      status: 'completed',
      book: BOOK,
    });

    await repository.fail(job.id, {
      statusCode: 502,
      code: 'INVALID_OUTPUT',
      message: 'bad',
    });
    await expect(repository.findById(job.id)).resolves.toMatchObject({
      status: 'failed',
      error: { code: 'INVALID_OUTPUT' },
    });
  });

  it('expires jobs after the TTL', async () => {
    const repository = new InMemoryJobRepository();
    const job = await repository.create({ userId: 'user-1', request: REQUEST });

    jest.setSystemTime(Date.now() + JOB_TTL_MS + 1);

    await expect(repository.findById(job.id)).resolves.toBeUndefined();
    await expect(repository.find(job.id, 'user-1')).resolves.toBeUndefined();
  });

  it('no-ops on unknown jobs', async () => {
    const repository = new InMemoryJobRepository();

    await expect(repository.markProcessing('missing')).resolves.toBeUndefined();
    await expect(repository.complete('missing', BOOK)).resolves.toBeUndefined();
    await expect(
      repository.fail('missing', {
        statusCode: 500,
        code: 'INTERNAL',
        message: 'x',
      }),
    ).resolves.toBeUndefined();
    await expect(repository.findById('missing')).resolves.toBeUndefined();
  });
});
