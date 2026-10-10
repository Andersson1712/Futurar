import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GeneratedPageDto {
  @ApiProperty({ example: 1 })
  pageNumber!: number;

  @ApiProperty()
  content!: string;

  @ApiPropertyOptional()
  imagePrompt?: string;

  @ApiPropertyOptional({
    description: 'Short-lived signed URL (never persisted)',
  })
  imageUrl?: string;
}

export class GeneratedBookDto {
  @ApiPropertyOptional()
  id?: string;

  @ApiPropertyOptional()
  version?: number;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  dedication?: string;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty({ type: [GeneratedPageDto] })
  pages!: GeneratedPageDto[];
}
