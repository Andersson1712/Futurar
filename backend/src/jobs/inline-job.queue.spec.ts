import { AiProviderError } from '../ai/ai.errors';
import type { GenerationRunner } from '../ai/application/generation-runner';
import { InlineJobQueue } from './inline-job.queue';
import type { JobRepository } from './job.repository';

function buildQueue(run: jest.Mock) {
  const fail = jest.fn().mockResolvedValue(undefined);
  const runner = { run } as unknown as GenerationRunner;
  const jobs = { fail } as unknown as JobRepository;

  return { queue: new InlineJobQueue(runner, jobs), run, fail };
}

describe('InlineJobQueue', () => {
  it('runs the generation and completes the job', async () => {
    const { queue, run, fail } = buildQueue(
      jest.fn().mockResolvedValue(undefined),
    );

    await queue.enqueue('job-1');

    expect(run).toHaveBeenCalledWith('job-1', undefined);
    expect(fail).not.toHaveBeenCalled();
  });

  it('forwards the correlation id to the runner (SPEC-027)', async () => {
    const { queue, run } = buildQueue(jest.fn().mockResolvedValue(undefined));

    await queue.enqueue('job-1', 'corr-1');

    expect(run).toHaveBeenCalledWith('job-1', 'corr-1');
  });

  it('marks the job failed and rethrows when generation fails', async () => {
    const error = new AiProviderError('RATE_LIMITED', 'quota');
    const { queue, fail } = buildQueue(jest.fn().mockRejectedValue(error));

    await expect(queue.enqueue('job-1')).rejects.toBe(error);
    expect(fail).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ code: 'RATE_LIMITED' }),
    );
  });
});
