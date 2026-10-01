import type { GenerateBookRequestDto } from '../dto/generate-book-request.dto';
import { AiProviderError } from '../ai.errors';
import type { TextGeneratorPort } from '../domain/ports/text-generator.port';
import type { JobRecord, JobRepository } from '../../jobs/job.repository';
import { BookOutputParser } from './book-output.parser';
import { BookOutputValidator } from './book-output.validator';
import { CircuitBreaker } from './circuit-breaker';
import { GenerationRunner } from './generation-runner';
import { PromptBuilderService } from './prompt-builder.service';

const REQUEST: GenerateBookRequestDto = {
  protagonist: 'Un dragón',
  scenery: 'Un bosque',
  mission: 'Encontrar la estrella',
  style: 'Acuarela',
  storySize: 'small',
};

const JOB: JobRecord = {
  id: 'job-1',
  userId: 'user-1',
  status: 'queued',
  request: REQUEST,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const VALID_BOOK_TEXT = JSON.stringify({
  title: 'La aventura del dragón',
  pages: [{ pageNumber: 1, content: 'Había una vez un dragón curioso.' }],
});

function buildRunner(job: JobRecord | null = JOB) {
  const findById = jest.fn().mockResolvedValue(job);
  const markProcessing = jest.fn().mockResolvedValue(undefined);
  const complete = jest.fn().mockResolvedValue(undefined);
  const jobs = {
    findById,
    markProcessing,
    complete,
  } as unknown as JobRepository;
  const generate = jest.fn();
  const textGenerator = { generate } as unknown as TextGeneratorPort;
  const runner = new GenerationRunner(
    jobs,
    new PromptBuilderService(),
    new BookOutputParser(),
    new BookOutputValidator(),
    new CircuitBreaker(),
    textGenerator,
  );

  return { runner, findById, markProcessing, complete, generate };
}

describe('GenerationRunner', () => {
  it('runs the pipeline and completes the job with a validated book', async () => {
    const { runner, markProcessing, complete, generate } = buildRunner();
    generate.mockResolvedValue({ text: VALID_BOOK_TEXT, model: 'gemini-test' });

    await runner.run('job-1');

    expect(markProcessing).toHaveBeenCalledWith('job-1');
    expect(complete).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({
        title: 'La aventura del dragón',
        totalPages: 1,
      }),
    );
  });

  it('throws NOT_FOUND when the job does not exist', async () => {
    const { runner, complete, generate } = buildRunner(null);

    await expect(runner.run('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(generate).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it('propagates provider failures without completing', async () => {
    const { runner, complete, generate } = buildRunner();
    generate.mockRejectedValue(new AiProviderError('RATE_LIMITED', 'quota'));

    await expect(runner.run('job-1')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it('propagates invalid output without completing', async () => {
    const { runner, complete, generate } = buildRunner();
    generate.mockResolvedValue({ text: 'not json', model: 'gemini-test' });

    await expect(runner.run('job-1')).rejects.toMatchObject({
      code: 'INVALID_OUTPUT',
    });
    expect(complete).not.toHaveBeenCalled();
  });
});
