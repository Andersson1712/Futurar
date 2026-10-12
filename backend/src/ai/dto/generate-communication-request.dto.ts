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
  COMMUNICATION_AUDIENCES,
  COMMUNICATION_CELL_COUNTS,
  COMMUNICATION_KINDS,
  COMMUNICATION_STYLE_MAX_LENGTH,
  COMMUNICATION_TOPIC_MAX_LENGTH,
} from '../domain/communication-generation.types';
import type {
  CommunicationAudience,
  CommunicationCellCount,
  CommunicationKind,
} from '../domain/communication-generation.types';

export class GenerateCommunicationRequestDto {
  @ApiProperty({
    enum: COMMUNICATION_KINDS,
    example: 'feelings',
  })
  @IsIn([...COMMUNICATION_KINDS])
  kind!: CommunicationKind;

  @ApiProperty({
    maxLength: COMMUNICATION_TOPIC_MAX_LENGTH,
    example: 'Cómo me siento hoy',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMUNICATION_TOPIC_MAX_LENGTH)
  topic!: string;

  @ApiProperty({
    maxLength: COMMUNICATION_STYLE_MAX_LENGTH,
    example: 'Pictogramas',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMUNICATION_STYLE_MAX_LENGTH)
  style!: string;

  @ApiProperty({ enum: [...COMMUNICATION_CELL_COUNTS], default: 6 })
  @IsIn([...COMMUNICATION_CELL_COUNTS])
  cellCount!: CommunicationCellCount;

  @ApiPropertyOptional({ enum: COMMUNICATION_AUDIENCES, default: 'child' })
  @IsOptional()
  @IsIn([...COMMUNICATION_AUDIENCES])
  audience?: CommunicationAudience;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Student/profile the board belongs to',
  })
  @IsOptional()
  @IsUUID()
  profileId?: string;
}
