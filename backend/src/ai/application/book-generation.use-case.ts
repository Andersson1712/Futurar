import { Injectable } from '@nestjs/common';
import { AiErrorException } from '../../common/errors/ai-error.exception';
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

@Injectable()
export class PendingBookGenerationUseCase implements BookGenerationUseCase {
  requestGeneration(): Promise<GenerateBookResponseDto> {
    return Promise.reject(
      new AiErrorException(
        501,
        'NOT_IMPLEMENTED',
        'Book generation pipeline lands in SPEC-004/005/006',
      ),
    );
  }

  getJobStatus(): Promise<JobStatusDto> {
    return Promise.reject(
      new AiErrorException(
        501,
        'NOT_IMPLEMENTED',
        'Job tracking lands in SPEC-006',
      ),
    );
  }
}
