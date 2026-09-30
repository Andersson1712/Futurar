import { GenerateBookRequestDto } from '../dto/generate-book-request.dto';
import {
  GenerateBookResponseDto,
  JobStatusDto,
} from '../dto/generate-book-response.dto';

export const BOOK_GENERATION_USE_CASE = Symbol('BOOK_GENERATION_USE_CASE');

export interface BookGenerationCommand extends GenerateBookRequestDto {
  userId: string;
}

export interface BookGenerationUseCase {
  requestGeneration(
    command: BookGenerationCommand,
  ): Promise<GenerateBookResponseDto>;
  getJobStatus(jobId: string, userId: string): Promise<JobStatusDto>;
}
