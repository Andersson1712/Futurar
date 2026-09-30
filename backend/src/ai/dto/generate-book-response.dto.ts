import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiErrorDto } from '../../common/dto/ai-error.dto';
import { BOOK_JOB_STATUSES } from '../domain/book-generation.types';
import type { BookJobStatus } from '../domain/book-generation.types';
import { GeneratedBookDto } from './generated-book.dto';

export class GenerateBookResponseDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty({ enum: BOOK_JOB_STATUSES })
  status!: BookJobStatus;
}

export class JobStatusDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: BOOK_JOB_STATUSES })
  status!: BookJobStatus;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  progress?: number;

  @ApiPropertyOptional({ type: GeneratedBookDto })
  book?: GeneratedBookDto;

  @ApiPropertyOptional({ type: AiErrorDto })
  error?: AiErrorDto;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
