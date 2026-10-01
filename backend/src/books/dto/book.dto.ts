import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GeneratedPageDto } from '../../ai/dto/generated-book.dto';

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
