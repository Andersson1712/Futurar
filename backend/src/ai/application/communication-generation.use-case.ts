import { GenerateCommunicationRequestDto } from '../dto/generate-communication-request.dto';
import {
  GenerateBookResponseDto,
  JobStatusDto,
} from '../dto/generate-book-response.dto';

export const COMMUNICATION_GENERATION_USE_CASE = Symbol(
  'COMMUNICATION_GENERATION_USE_CASE',
);
export const COMMUNICATION_JOB_QUEUE = Symbol('COMMUNICATION_JOB_QUEUE');

export const COMMUNICATION_GENERATION_QUEUE = 'communication-generation';

export interface CommunicationGenerationCommand extends GenerateCommunicationRequestDto {
  userId: string;
  /** SPEC-027: end-to-end correlation id (never persisted, logs only). */
  correlationId?: string;
}

export interface CommunicationJobPayload {
  jobId: string;
  /** SPEC-027: end-to-end correlation id for job logs (never persisted). */
  correlationId?: string;
}

export interface CommunicationGenerationUseCase {
  requestGeneration(
    command: CommunicationGenerationCommand,
  ): Promise<GenerateBookResponseDto>;
  getJobStatus(jobId: string, userId: string): Promise<JobStatusDto>;
}
