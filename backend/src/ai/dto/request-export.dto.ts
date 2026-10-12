import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { EXPORT_FORMATS } from '../domain/export-generation.types';
import type { ExportFormat } from '../domain/export-generation.types';

export class RequestExportDto {
  @ApiProperty({ enum: EXPORT_FORMATS, example: 'epub' })
  @IsIn([...EXPORT_FORMATS])
  format!: ExportFormat;
}
