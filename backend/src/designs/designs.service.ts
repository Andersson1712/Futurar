import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { DEFAULT_SIGNED_URL_TTL_SECONDS } from '../ai/application/book-persistence.service';
import { BOOK_STORAGE } from '../books/book-storage.port';
import type { BookStorage } from '../books/book-storage.port';
import { AiErrorException } from '../common/errors/ai-error.exception';
import type { StoredDesign, StoredDesignSummary } from './design.repository';
import { DESIGN_REPOSITORY } from './design.repository';
import type { DesignRepository } from './design.repository';

export class DesignSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  occasion!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class DesignDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  occasion!: string;

  @ApiProperty()
  style!: string;

  @ApiPropertyOptional()
  audience?: string;

  @ApiPropertyOptional()
  imagePrompt?: string;

  @ApiPropertyOptional({
    description: 'Short-lived signed URL (never persisted)',
  })
  imageUrl?: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class ListDesignsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  profileId?: string;
}

@Injectable()
export class DesignsService {
  constructor(
    @Inject(DESIGN_REPOSITORY) private readonly designs: DesignRepository,
    @Inject(BOOK_STORAGE) private readonly storage: BookStorage,
    private readonly configService: ConfigService,
  ) {}

  async list(userId: string, profileId?: string): Promise<DesignSummaryDto[]> {
    const designs = await this.designs.listByUser(userId, profileId);

    return designs.map(toSummaryDto);
  }

  async get(designId: string, userId: string): Promise<DesignDetailDto> {
    const design = await this.designs.findById(designId, userId);

    if (!design) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Design not found');
    }

    return this.toDetailDto(design);
  }

  async remove(designId: string, userId: string): Promise<void> {
    const deleted = await this.designs.softDelete(designId, userId);

    if (!deleted) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Design not found');
    }
  }

  private async toDetailDto(design: StoredDesign): Promise<DesignDetailDto> {
    const ttlSeconds =
      this.configService.get<number>('BOOK_IMAGE_SIGNED_URL_TTL_SECONDS') ??
      DEFAULT_SIGNED_URL_TTL_SECONDS;

    return {
      id: design.id,
      title: design.title,
      message: design.version.message,
      occasion: design.version.occasion,
      style: design.version.style,
      audience: design.version.audience,
      imagePrompt: design.version.imagePrompt,
      imageUrl: design.version.imagePath
        ? await this.storage.signedUrl(design.version.imagePath, ttlSeconds)
        : undefined,
      version: design.currentVersion,
      createdAt: design.createdAt.toISOString(),
      updatedAt: design.updatedAt.toISOString(),
    };
  }
}

function toSummaryDto(summary: StoredDesignSummary): DesignSummaryDto {
  return {
    id: summary.id,
    title: summary.title,
    occasion: summary.occasion,
    version: summary.currentVersion,
    createdAt: summary.createdAt.toISOString(),
    updatedAt: summary.updatedAt.toISOString(),
  };
}
