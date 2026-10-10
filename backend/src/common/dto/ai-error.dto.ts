import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AiErrorCode } from '../ai/ai-error-code';

export class AiErrorDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'VALIDATION_FAILED' })
  code!: AiErrorCode;

  @ApiProperty({ example: 'Request validation failed' })
  message!: string;

  @ApiPropertyOptional({ type: [String] })
  details?: string[];
}
