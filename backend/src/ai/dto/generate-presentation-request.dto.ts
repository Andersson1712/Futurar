import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  PRESENTATION_AUDIENCES,
  PRESENTATION_SLIDE_COUNTS,
  PRESENTATION_STYLE_MAX_LENGTH,
  PRESENTATION_TOPIC_MAX_LENGTH,
} from '../domain/presentation-generation.types';
import type {
  PresentationAudience,
  PresentationSlideCount,
} from '../domain/presentation-generation.types';

export class GeneratePresentationRequestDto {
  @ApiProperty({
    maxLength: PRESENTATION_TOPIC_MAX_LENGTH,
    example: 'Los dinosaurios',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRESENTATION_TOPIC_MAX_LENGTH)
  topic!: string;

  @ApiProperty({
    maxLength: PRESENTATION_STYLE_MAX_LENGTH,
    example: 'Acuarela',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRESENTATION_STYLE_MAX_LENGTH)
  style!: string;

  @ApiProperty({ enum: [...PRESENTATION_SLIDE_COUNTS], default: 5 })
  @IsIn([...PRESENTATION_SLIDE_COUNTS])
  slideCount!: PresentationSlideCount;

  @ApiPropertyOptional({ enum: PRESENTATION_AUDIENCES, default: 'child' })
  @IsOptional()
  @IsIn([...PRESENTATION_AUDIENCES])
  audience?: PresentationAudience;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Student/profile the presentation belongs to',
  })
  @IsOptional()
  @IsUUID()
  profileId?: string;
}
