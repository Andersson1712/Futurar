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
  DESIGN_AUDIENCES,
  DESIGN_MESSAGE_MAX_LENGTH,
  DESIGN_OCCASIONS,
} from '../domain/design-generation.types';
import type {
  DesignAudience,
  DesignOccasion,
} from '../domain/design-generation.types';

export class GenerateDesignRequestDto {
  @ApiProperty({
    enum: DESIGN_OCCASIONS,
    example: 'birthday',
  })
  @IsIn([...DESIGN_OCCASIONS])
  occasion!: DesignOccasion;

  @ApiProperty({
    maxLength: DESIGN_MESSAGE_MAX_LENGTH,
    example: 'Fiesta de cumple el sabado a las 17',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(DESIGN_MESSAGE_MAX_LENGTH)
  message!: string;

  @ApiProperty({ maxLength: 80, example: 'Acuarela' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  style!: string;

  @ApiPropertyOptional({ enum: DESIGN_AUDIENCES, default: 'child' })
  @IsOptional()
  @IsIn([...DESIGN_AUDIENCES])
  audience?: DesignAudience;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Student/profile the design belongs to',
  })
  @IsOptional()
  @IsUUID()
  profileId?: string;
}
