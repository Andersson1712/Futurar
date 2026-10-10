import { GenerateDesignRequestDto } from '../dto/generate-design-request.dto';
import {
  GenerateBookResponseDto,
  JobStatusDto,
} from '../dto/generate-book-response.dto';

export const DESIGN_GENERATION_USE_CASE = Symbol('DESIGN_GENERATION_USE_CASE');
export const DESIGN_JOB_QUEUE = Symbol('DESIGN_JOB_QUEUE');

export const DESIGN_GENERATION_QUEUE = 'design-generation';

export interface DesignGenerationCommand extends GenerateDesignRequestDto {
  userId: string;
  /** SPEC-027: end-to-end correlation id (never persisted, logs only). */
  correlationId?: string;
}

export interface DesignJobPayload {
  jobId: string;
  /** SPEC-027: end-to-end correlation id for job logs (never persisted). */
  correlationId?: string;
}

export interface DesignGenerationUseCase {
  requestGeneration(
    command: DesignGenerationCommand,
  ): Promise<GenerateBookResponseDto>;
  getJobStatus(jobId: string, userId: string): Promise<JobStatusDto>;
}
