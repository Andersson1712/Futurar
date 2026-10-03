import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AiErrorException } from '../../common/errors/ai-error.exception';
import { JOB_REPOSITORY } from '../../jobs/job.repository';
import type { JobRepository } from '../../jobs/job.repository';
import { MetricsService } from '../../observability/metrics.service';
import { PROFILE_SETTINGS_PROVIDER } from '../../profiles/profile-settings.provider';
import type { ProfileSettingsProvider } from '../../profiles/profile-settings.provider';
import type { TextGeneratorPort } from '../domain/ports/text-generator.port';
import { TEXT_GENERATOR } from '../tokens';
import { BookOutputParser } from './book-output.parser';
import { BookOutputValidator } from './book-output.validator';
import { BookPersistenceService } from './book-persistence.service';
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
    private readonly persistence: BookPersistenceService,
    @Inject(PROFILE_SETTINGS_PROVIDER)
    private readonly profileSettings: ProfileSettingsProvider,
    @Inject(TEXT_GENERATOR) private readonly textGenerator: TextGeneratorPort,
    private readonly logger: PinoLogger,
    private readonly metrics: MetricsService,
  ) {
    this.logger.setContext(GenerationRunner.name);
  }

  async run(jobId: string, correlationId?: string): Promise<void> {
    const startedAt = Date.now();
    const context = {
      jobId,
      ...(correlationId ? { correlationId } : {}),
    };
    this.logger.info(context, 'Running book generation');

    try {
      const usage = await this.execute(jobId);

      const latencyMs = Date.now() - startedAt;
      this.metrics.recordGeneration({
        success: true,
        latencyMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });
      this.logger.info({ ...context, latencyMs }, 'Book generation completed');
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      this.metrics.recordGeneration({ success: false, latencyMs });
      this.logger.error(
        { ...context, latencyMs, err: error },
        'Book generation failed',
      );
      throw error;
    }
  }

  private async execute(
    jobId: string,
  ): Promise<{ inputTokens?: number; outputTokens?: number }> {
    const job = await this.jobs.findById(jobId);

    if (!job) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Job not found');
    }

    await this.jobs.markProcessing(jobId);

    const defaults = job.request.profileId
      ? await this.profileSettings.getBookDefaults(job.request.profileId)
      : {};
    const audience = job.request.audience ?? defaults.audience ?? 'child';
    const storySize = job.request.storySize ?? defaults.storySize ?? 'medium';
    const bookPrompt = this.promptBuilder.build({
      ...job.request,
      storySize,
      audience,
      userId: job.userId,
    });
    const result = await this.breaker.execute(() =>
      this.textGenerator.generate({
        prompt: bookPrompt.prompt,
        systemInstruction: bookPrompt.systemInstruction,
        temperature: BOOK_TEMPERATURE,
        maxOutputTokens: BOOK_MAX_OUTPUT_TOKENS,
        responseJsonSchema: bookPrompt.responseJsonSchema,
        tenantId: job.userId,
      }),
    );
    const payload = this.parser.parse(result.text);
    const book = this.validator.validate(payload, audience);
    const storedBook = await this.persistence.persist({
      userId: job.userId,
      profileId: job.request.profileId,
      book,
      storyConfig: {
        protagonist: job.request.protagonist,
        scenery: job.request.scenery,
        mission: job.request.mission,
        style: job.request.style,
        storySize,
        audience,
      },
      model: result.model,
      promptVersion: bookPrompt.version,
      usage: result.usage,
      generationJobId: jobId,
      dedication: job.request.dedication,
    });

    await this.jobs.complete(jobId, storedBook);

    return {
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
    };
  }
}
