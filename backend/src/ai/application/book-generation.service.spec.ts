import { AiErrorException } from '../../common/errors/ai-error.exception';
import type { JobQueue } from '../../jobs/job-queue.port';
import type { JobRecord, JobRepository } from '../../jobs/job.repository';
import { BookGenerationService } from './book-generation.service';
import { BookOutputValidator } from './book-output.validator';
import type { BookGenerationCommand } from './book-generation.use-case';

const COMMAND: BookGenerationCommand = {
  protagonist: 'Un dragón curioso',
  scenery: 'Un bosque mágico',
  mission: 'Encontrar la estrella perdida',
  style: 'Acuarela',
  storySize: 'small',
  userId: 'user-1',
};

function buildJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    userId: 'user-1',
    status: 'queued',
    request: COMMAND,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildService(
  options: { current?: JobRecord; found?: JobRecord } = {},
) {
  const create = jest.fn().mockResolvedValue(buildJob());
  const findById = jest
    .fn()
    .mockResolvedValue(options.current ?? buildJob({ status: 'completed' }));
  const find = jest.fn().mockResolvedValue(options.found ?? buildJob());
  const enqueue = jest.fn().mockResolvedValue(undefined);
  const jobs = { create, findById, find } as unknown as JobRepository;
  const queue = { enqueue } as unknown as JobQueue;
  const service = new BookGenerationService(
    new BookOutputValidator(),
    jobs,
    queue,
  );

  return { service, create, findById, find, enqueue };
}

describe('BookGenerationService', () => {
  it('creates the job, enqueues it and returns the current status', async () => {
    const { service, create, enqueue } = buildService();

    const response = await service.requestGeneration(COMMAND);

    expect(create).toHaveBeenCalledWith({
      userId: 'user-1',
      request: COMMAND,
    });
    expect(enqueue).toHaveBeenCalledWith('job-1', undefined);
    expect(response).toEqual({ jobId: 'job-1', status: 'completed' });
  });

  it('propagates the correlation id to the queue (SPEC-027)', async () => {
    const { service, enqueue } = buildService();

    await service.requestGeneration({ ...COMMAND, correlationId: 'corr-1' });

    expect(enqueue).toHaveBeenCalledWith('job-1', 'corr-1');
  });

  it('returns queued status when the driver has not finished yet', async () => {
    const { service } = buildService({
      current: buildJob({ status: 'processing' }),
    });

    await expect(service.requestGeneration(COMMAND)).resolves.toEqual({
      jobId: 'job-1',
      status: 'processing',
    });
  });

  it('blocks inappropriate input before creating a job', async () => {
    const { service, create, enqueue } = buildService();

    await expect(
      service.requestGeneration({
        ...COMMAND,
        mission: 'Quiere matar al ogro',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(create).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('propagates queue failures', async () => {
    const { service, enqueue } = buildService();
    enqueue.mockRejectedValue(new Error('redis down'));

    await expect(service.requestGeneration(COMMAND)).rejects.toThrow(
      'redis down',
    );
  });

  it('returns the job status scoped to the user', async () => {
    const { service, find } = buildService();

    const status = await service.getJobStatus('job-1', 'user-1');

    expect(find).toHaveBeenCalledWith('job-1', 'user-1');
    expect(status).toMatchObject({ id: 'job-1', status: 'queued' });
  });

  it('rejects unknown jobs with 404', async () => {
    const { service, find } = buildService();
    find.mockResolvedValue(undefined);

    const error = await service
      .getJobStatus('missing', 'user-1')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiErrorException);
    expect((error as AiErrorException).getStatus()).toBe(404);
  });
});
