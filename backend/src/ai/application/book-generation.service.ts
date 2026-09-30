import { Inject, Injectable } from '@nestjs/common';
import { AiErrorException } from '../../common/errors/ai-error.exception';
import { toAiErrorDto } from '../../common/errors/to-ai-error';
import type { TextGeneratorPort } from '../domain/ports/text-generator.port';
import {
  GenerateBookResponseDto,
  JobStatusDto,
} from '../dto/generate-book-response.dto';
import { InMemoryJobRegistry } from './in-memory-job.registry';
import { BookOutputParser } from './book-output.parser';
import { BookOutputValidator } from './book-output.validator';
import type {
  BookGenerationCommand,
  BookGenerationUseCase,
} from './book-generation.use-case';
import {
  BOOK_MAX_OUTPUT_TOKENS,
  BOOK_TEMPERATURE,
  PromptBuilderService,
} from './prompt-builder.service';
import { TEXT_GENERATOR } from '../tokens';

@Injectable()
export class BookGenerationService implements BookGenerationUseCase {
  constructor(
    private readonly promptBuilder: PromptBuilderService,
    @Inject(TEXT_GENERATOR) private readonly textGenerator: TextGeneratorPort,
    private readonly parser: BookOutputParser,
    private readonly validator: BookOutputValidator,
    private readonly jobs: InMemoryJobRegistry,
  ) {}

  async requestGeneration(
    command: BookGenerationCommand,
  ): Promise<GenerateBookResponseDto> {
    const audience = command.audience ?? 'child';
    this.validator.assertInputAllowed(command, audience);

    const job = this.jobs.create(command.userId);

    try {
      const bookPrompt = this.promptBuilder.build(command);
      const result = await this.textGenerator.generate({
        prompt: bookPrompt.prompt,
        systemInstruction: bookPrompt.systemInstruction,
        temperature: BOOK_TEMPERATURE,
        maxOutputTokens: BOOK_MAX_OUTPUT_TOKENS,
        responseJsonSchema: bookPrompt.responseJsonSchema,
      });
      const payload = this.parser.parse(result.text);
      const book = this.validator.validate(payload, audience);
      this.jobs.complete(job.id, book);
    } catch (error) {
      this.jobs.fail(job.id, toAiErrorDto(error));
      throw error;
    }

    return { jobId: job.id, status: 'completed' };
  }

  getJobStatus(jobId: string, userId: string): Promise<JobStatusDto> {
    const job = this.jobs.find(jobId, userId);

    if (!job) {
      return Promise.reject(
        new AiErrorException(404, 'NOT_FOUND', 'Job not found'),
      );
    }

    return Promise.resolve({
      id: job.id,
      status: job.status,
      progress: job.status === 'completed' ? 100 : undefined,
      book: job.book,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    });
  }
}
