import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GeneratedPageDto {
  @ApiProperty({ example: 1 })
  pageNumber!: number;

  @ApiProperty()
  content!: string;

  @ApiPropertyOptional()
  imagePrompt?: string;
}

export class GeneratedBookDto {
  @ApiProperty()
  title!: string;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty({ type: [GeneratedPageDto] })
  pages!: GeneratedPageDto[];
}
