import type { GenerateBookRequestDto } from '../dto/generate-book-request.dto';
import { AiProviderError } from '../ai.errors';
import type { TextGeneratorPort } from '../domain/ports/text-generator.port';
import type { JobRecord, JobRepository } from '../../jobs/job.repository';
import { BookOutputParser } from './book-output.parser';
import { BookOutputValidator } from './book-output.validator';
import type {
  BookPersistenceService,
  PersistBookInput,
} from './book-persistence.service';
import { CircuitBreaker } from './circuit-breaker';
import { GenerationRunner } from './generation-runner';
import { PromptBuilderService } from './prompt-builder.service';
import { MetricsService } from '../../observability/metrics.service';
import { fakePinoLogger } from '../../observability/fake-pino-logger';
import type { ProfileSettingsProvider } from '../../profiles/profile-settings.provider';

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
  const recordCost = jest.fn().mockResolvedValue(undefined);
  const jobs = {
    findById,
    markProcessing,
    complete,
    recordCost,
  } as unknown as JobRepository;
  const generate = jest.fn();
  const textGenerator = { generate } as unknown as TextGeneratorPort;
  const persist = jest.fn().mockImplementation((input: { book: unknown }) =>
    Promise.resolve({
      id: 'book-1',
      version: 1,
      ...(input.book as object),
    }),
  );
  const persistence = { persist } as unknown as BookPersistenceService;
  const getBookDefaults = jest.fn().mockResolvedValue({});
  const profileSettings = {
    getBookDefaults,
  } as unknown as ProfileSettingsProvider;
  const metrics = new MetricsService();
  const runner = new GenerationRunner(
    jobs,
    new PromptBuilderService(),
    new BookOutputParser(),
    new BookOutputValidator(),
    new CircuitBreaker(),
    persistence,
    profileSettings,
    textGenerator,
    fakePinoLogger(),
    metrics,
  );

  return {
    runner,
    findById,
    markProcessing,
    complete,
    recordCost,
    generate,
    persist,
    getBookDefaults,
    metrics,
  };
}

describe('GenerationRunner', () => {
  it('runs the pipeline, persists and completes the job with the stored book', async () => {
    const { runner, markProcessing, complete, generate, persist } =
      buildRunner();
    generate.mockResolvedValue({
      text: VALID_BOOK_TEXT,
      model: 'gemini-test',
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    await runner.run('job-1');

    expect(markProcessing).toHaveBeenCalledWith('job-1');
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        model: 'gemini-test',
        promptVersion: 'book/v1',
        generationJobId: 'job-1',
      }),
    );

    const persistCalls = persist.mock.calls as unknown as Array<
      [PersistBookInput]
    >;
    expect(persistCalls[0][0].storyConfig).toMatchObject({
      protagonist: 'Un dragón',
      storySize: 'small',
    });
    expect(complete).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({
        id: 'book-1',
        title: 'La aventura del dragón',
        totalPages: 1,
      }),
    );
  });

  it('falls back to the profile book defaults when the request omits them', async () => {
    const job = {
      ...JOB,
      request: {
        protagonist: 'Un dragón',
        scenery: 'Un bosque',
        mission: 'Encontrar la estrella',
        style: 'Acuarela',
        profileId: 'student-1',
      },
    };
    const { runner, persist, getBookDefaults, generate } = buildRunner(job);
    getBookDefaults.mockResolvedValue({ storySize: 'large', audience: 'teen' });
    generate.mockResolvedValue({ text: VALID_BOOK_TEXT, model: 'gemini-test' });

    await runner.run('job-1');

    expect(getBookDefaults).toHaveBeenCalledWith('student-1');
    const persistCalls = persist.mock.calls as unknown as Array<
      [PersistBookInput]
    >;
    expect(persistCalls[0][0].storyConfig).toMatchObject({
      storySize: 'large',
      audience: 'teen',
    });
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

  it('records generation metrics with token usage (SPEC-027)', async () => {
    const { runner, generate, metrics } = buildRunner();
    generate.mockResolvedValue({
      text: VALID_BOOK_TEXT,
      model: 'gemini-test',
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    await runner.run('job-1', 'corr-1');

    expect(metrics.snapshot().generation).toMatchObject({
      jobs: 1,
      succeeded: 1,
      failed: 0,
      inputTokens: 10,
      outputTokens: 20,
    });
  });

  it('records failed generations in metrics (SPEC-027)', async () => {
    const { runner, generate, metrics } = buildRunner();
    generate.mockRejectedValue(new AiProviderError('RATE_LIMITED', 'quota'));

    await expect(runner.run('job-1', 'corr-1')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    expect(metrics.snapshot().generation).toMatchObject({
      jobs: 1,
      succeeded: 0,
      failed: 1,
    });
  });

  it('records cost in metrics and on the job row when usage carries costUsd (SPEC-033)', async () => {
    const { runner, generate, metrics, recordCost, persist } = buildRunner();
    generate.mockResolvedValue({
      text: VALID_BOOK_TEXT,
      model: 'google/gemini-3.8-flash',
      usage: { inputTokens: 100, outputTokens: 200, costUsd: 0.0042 },
    });

    await runner.run('job-1', 'corr-1');

    expect(metrics.snapshot().generation).toMatchObject({
      jobs: 1,
      succeeded: 1,
    });
    expect(metrics.snapshot().generation.costUsd).toBeCloseTo(0.0042, 6);
    expect(recordCost).toHaveBeenCalledWith('job-1', 0.0042);
    const persistCalls = persist.mock.calls as unknown as Array<
      [PersistBookInput]
    >;
    expect(persistCalls[0][0].usage).toMatchObject({ costUsd: 0.0042 });
  });

  it('skips job cost recording when usage carries no cost (SPEC-033)', async () => {
    const { runner, generate, metrics, recordCost } = buildRunner();
    generate.mockResolvedValue({
      text: VALID_BOOK_TEXT,
      model: 'gemini-test',
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    await runner.run('job-1', 'corr-1');

    expect(metrics.snapshot().generation.costUsd).toBe(0);
    expect(recordCost).not.toHaveBeenCalled();
  });
});
