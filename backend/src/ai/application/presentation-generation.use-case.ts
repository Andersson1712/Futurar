import { GeneratePresentationRequestDto } from '../dto/generate-presentation-request.dto';
import {
  GenerateBookResponseDto,
  JobStatusDto,
} from '../dto/generate-book-response.dto';

export const PRESENTATION_GENERATION_USE_CASE = Symbol(
  'PRESENTATION_GENERATION_USE_CASE',
);
export const PRESENTATION_JOB_QUEUE = Symbol('PRESENTATION_JOB_QUEUE');

export const PRESENTATION_GENERATION_QUEUE = 'presentation-generation';

export interface PresentationGenerationCommand extends GeneratePresentationRequestDto {
  userId: string;
  /** SPEC-027: end-to-end correlation id (never persisted, logs only). */
  correlationId?: string;
}

export interface PresentationJobPayload {
  jobId: string;
  /** SPEC-027: end-to-end correlation id for job logs (never persisted). */
  correlationId?: string;
}

export interface PresentationGenerationUseCase {
  requestGeneration(
    command: PresentationGenerationCommand,
  ): Promise<GenerateBookResponseDto>;
  getJobStatus(jobId: string, userId: string): Promise<JobStatusDto>;
}
