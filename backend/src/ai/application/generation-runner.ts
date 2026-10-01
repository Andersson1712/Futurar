import { Inject, Injectable } from '@nestjs/common';
import { AiErrorException } from '../../common/errors/ai-error.exception';
import { JOB_REPOSITORY } from '../../jobs/job.repository';
import type { JobRepository } from '../../jobs/job.repository';
import type { TextGeneratorPort } from '../domain/ports/text-generator.port';
import { TEXT_GENERATOR } from '../tokens';
import { BookOutputParser } from './book-output.parser';
import { BookOutputValidator } from './book-output.validator';
import { CircuitBreaker } from './circuit-breaker';
import {
  BOOK_MAX_OUTPUT_TOKENS,
  BOOK_TEMPERATURE,
  PromptBuilderService,
} from './prompt-builder.service';

@Injectable()
export class GenerationRunner {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    private readonly promptBuilder: PromptBuilderService,
    private readonly parser: BookOutputParser,
    private readonly validator: BookOutputValidator,
    private readonly breaker: CircuitBreaker,
    @Inject(TEXT_GENERATOR) private readonly textGenerator: TextGeneratorPort,
  ) {}

  async run(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);

    if (!job) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Job not found');
    }

    await this.jobs.markProcessing(jobId);

    const audience = job.request.audience ?? 'child';
    const bookPrompt = this.promptBuilder.build({
      ...job.request,
      userId: job.userId,
    });
    const result = await this.breaker.execute(() =>
      this.textGenerator.generate({
        prompt: bookPrompt.prompt,
        systemInstruction: bookPrompt.systemInstruction,
        temperature: BOOK_TEMPERATURE,
        maxOutputTokens: BOOK_MAX_OUTPUT_TOKENS,
        responseJsonSchema: bookPrompt.responseJsonSchema,
      }),
    );
    const payload = this.parser.parse(result.text);
    const book = this.validator.validate(payload, audience);

    await this.jobs.complete(jobId, book);
  }
}
