import { RequestExportDto } from '../dto/request-export.dto';
import {
  GenerateBookResponseDto,
  JobStatusDto,
} from '../dto/generate-book-response.dto';

export const EXPORT_GENERATION_USE_CASE = Symbol('EXPORT_GENERATION_USE_CASE');
export const EXPORT_JOB_QUEUE = Symbol('EXPORT_JOB_QUEUE');

export const EXPORT_GENERATION_QUEUE = 'export-generation';

export interface ExportGenerationCommand extends RequestExportDto {
  userId: string;
  /** Set for book exports (epub). */
  bookId?: string;
  /** Set for design exports (pdf). */
  designId?: string;
  /** SPEC-027: end-to-end correlation id (never persisted, logs only). */
  correlationId?: string;
}

export interface ExportJobPayload {
  jobId: string;
  /** SPEC-027: end-to-end correlation id for job logs (never persisted). */
  correlationId?: string;
}

export interface ExportGenerationUseCase {
  requestExport(
    command: ExportGenerationCommand,
  ): Promise<GenerateBookResponseDto>;
  getJobStatus(jobId: string, userId: string): Promise<JobStatusDto>;
}
