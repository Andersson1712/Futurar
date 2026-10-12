import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AUDIENCES, STORY_SIZES } from '../domain/book-generation.types';
import type { Audience, StorySize } from '../domain/book-generation.types';

export const DEDICATION_POSITIONS = ['start', 'end'] as const;
export type DedicationPosition = (typeof DEDICATION_POSITIONS)[number];

export class DedicationDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  to!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;

  @ApiProperty({ enum: DEDICATION_POSITIONS })
  @IsIn([...DEDICATION_POSITIONS])
  position!: DedicationPosition;
}

export class GenerateBookRequestDto {
  @ApiProperty({ maxLength: 120, example: 'Un dragón curioso' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  protagonist!: string;

  @ApiProperty({ maxLength: 120, example: 'Un bosque mágico' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  scenery!: string;

  @ApiProperty({ maxLength: 200, example: 'Encontrar la estrella perdida' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  mission!: string;

  @ApiProperty({ maxLength: 80, example: 'Acuarela' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  style!: string;

  @ApiPropertyOptional({
    enum: STORY_SIZES,
    description: 'Defaults to the profile book complexity when omitted',
  })
  @IsOptional()
  @IsIn([...STORY_SIZES])
  storySize?: StorySize;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customStructure?: string;

  @ApiPropertyOptional({ type: DedicationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DedicationDto)
  dedication?: DedicationDto;

  @ApiPropertyOptional({ enum: AUDIENCES, default: 'child' })
  @IsOptional()
  @IsIn([...AUDIENCES])
  audience?: Audience;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Student/profile the book belongs to',
  })
  @IsOptional()
  @IsUUID()
  profileId?: string;
}
