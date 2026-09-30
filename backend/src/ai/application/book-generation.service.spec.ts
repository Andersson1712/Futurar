import { AiErrorException } from '../../common/errors/ai-error.exception';
import { AiProviderError } from '../ai.errors';
import type { TextGenerationRequest } from '../domain/ports/text-generator.port';
import type { TextGeneratorPort } from '../domain/ports/text-generator.port';
import { BookGenerationService } from './book-generation.service';
import { BookOutputParser } from './book-output.parser';
import { BookOutputValidator } from './book-output.validator';
import type { BookGenerationCommand } from './book-generation.use-case';
import { InMemoryJobRegistry } from './in-memory-job.registry';
import { PromptBuilderService } from './prompt-builder.service';

const COMMAND: BookGenerationCommand = {
  protagonist: 'Un dragón curioso',
  scenery: 'Un bosque mágico',
  mission: 'Encontrar la estrella perdida',
  style: 'Acuarela',
  storySize: 'small',
  userId: 'user-1',
};

const VALID_BOOK_TEXT = JSON.stringify({
  title: 'La aventura del dragón',
  pages: [
    { pageNumber: 1, content: 'Había una vez un dragón curioso.' },
    { pageNumber: 2, content: 'Y encontró la estrella perdida.' },
  ],
});

function buildService(generate: jest.Mock) {
  const textGenerator = { generate } as unknown as TextGeneratorPort;
  const service = new BookGenerationService(
    new PromptBuilderService(),
    textGenerator,
    new BookOutputParser(),
    new BookOutputValidator(),
    new InMemoryJobRegistry(),
  );

  return { service, generate };
}

describe('BookGenerationService', () => {
  it('generates, validates and completes the job', async () => {
    const generate = jest.fn().mockResolvedValue({
      text: VALID_BOOK_TEXT,
      model: 'gemini-test',
    });
    const { service } = buildService(generate);

    const response = await service.requestGeneration(COMMAND);

    expect(response.status).toBe('completed');

    const calls = generate.mock.calls as unknown as Array<
      [TextGenerationRequest]
    >;
    expect(calls[0][0].prompt).toContain('Un dragón curioso');
    expect(calls[0][0].responseJsonSchema).toBeDefined();

    const status = await service.getJobStatus(response.jobId, COMMAND.userId);
    expect(status.status).toBe('completed');
    expect(status.progress).toBe(100);
    expect(status.book?.title).toBe('La aventura del dragón');
    expect(status.book?.totalPages).toBe(2);
  });

  it('marks the job as failed when the provider fails and rethrows', async () => {
    const generate = jest
      .fn()
      .mockRejectedValue(new AiProviderError('RATE_LIMITED', 'quota'));
    const { service } = buildService(generate);

    const error = await service
      .requestGeneration(COMMAND)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiProviderError);
    expect((error as AiProviderError).code).toBe('RATE_LIMITED');
  });

  it('fails the job with INVALID_OUTPUT when the provider returns junk', async () => {
    const generate = jest.fn().mockResolvedValue({
      text: 'No tengo JSON',
      model: 'gemini-test',
    });
    const { service } = buildService(generate);

    const error = await service
      .requestGeneration(COMMAND)
      .catch((caught: unknown) => caught);

    expect((error as AiProviderError).code).toBe('INVALID_OUTPUT');
  });

  it('blocks inappropriate input before calling the provider', async () => {
    const generate = jest.fn();
    const { service } = buildService(generate);

    await expect(
      service.requestGeneration({
        ...COMMAND,
        mission: 'Quiere matar al ogro',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown jobs or other users', async () => {
    const generate = jest.fn().mockResolvedValue({
      text: VALID_BOOK_TEXT,
      model: 'gemini-test',
    });
    const { service } = buildService(generate);

    await expect(
      service.getJobStatus('missing', 'user-1'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const response = await service.requestGeneration(COMMAND);
    await expect(
      service.getJobStatus(response.jobId, 'other-user'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns AiErrorException with 404 status for unknown jobs', async () => {
    const { service } = buildService(jest.fn());

    const error = await service
      .getJobStatus('missing', 'user-1')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiErrorException);
    expect((error as AiErrorException).getStatus()).toBe(404);
  });
});
