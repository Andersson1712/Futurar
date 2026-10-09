import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const MODEL_SLUG_MAX_LENGTH = 120;

export class ModelPreferenceDto {
  @ApiPropertyOptional({ description: 'Curated OpenRouter text model slug' })
  @IsOptional()
  @IsString()
  @MaxLength(MODEL_SLUG_MAX_LENGTH)
  textModel?: string;

  @ApiPropertyOptional({ description: 'Curated OpenRouter image model slug' })
  @IsOptional()
  @IsString()
  @MaxLength(MODEL_SLUG_MAX_LENGTH)
  imageModel?: string;
}

export class ModelPreferenceResponseDto {
  @ApiPropertyOptional() textModel?: string;

  @ApiPropertyOptional() imageModel?: string;
}

export class ModelDefaultsDto {
  @ApiProperty() text!: string;

  @ApiProperty() image!: string;
}

export class ModelCatalogDto {
  @ApiProperty({ type: [String] }) text!: string[];

  @ApiProperty({ type: [String] }) image!: string[];

  @ApiProperty({ type: ModelDefaultsDto }) defaults!: ModelDefaultsDto;
}
