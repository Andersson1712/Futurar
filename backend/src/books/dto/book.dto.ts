import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { GeneratedPageDto } from '../../ai/dto/generated-book.dto';
import {
  DEDICATION_POSITIONS,
  type DedicationPosition,
} from '../../ai/dto/generate-book-request.dto';

export class BookSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  pageCount!: number;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  isFavorite!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class BookDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  dedication?: string;

  @ApiPropertyOptional()
  dedicationTo?: string;

  @ApiPropertyOptional()
  dedicationReason?: string;

  @ApiPropertyOptional({ enum: DEDICATION_POSITIONS })
  dedicationPosition?: DedicationPosition;

  @ApiProperty()
  protagonist!: string;

  @ApiProperty()
  scenery!: string;

  @ApiProperty()
  mission!: string;

  @ApiProperty()
  style!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty({ type: [GeneratedPageDto] })
  pages!: GeneratedPageDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class SaveDedicationDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  to!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiProperty({ enum: DEDICATION_POSITIONS })
  @IsIn([...DEDICATION_POSITIONS])
  position!: DedicationPosition;
}

export class SaveFavoriteDto {
  @ApiProperty()
  @IsBoolean()
  isFavorite!: boolean;
}
