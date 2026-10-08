import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { DEFAULT_SIGNED_URL_TTL_SECONDS } from '../ai/application/book-persistence.service';
import { BOOK_STORAGE } from '../books/book-storage.port';
import type { BookStorage } from '../books/book-storage.port';
import { AiErrorException } from '../common/errors/ai-error.exception';
import type {
  StoredPresentation,
  StoredPresentationSummary,
} from './presentation.repository';
import { PRESENTATION_REPOSITORY } from './presentation.repository';
import type { PresentationRepository } from './presentation.repository';

export class PresentationSlideDto {
  @ApiProperty()
  title!: string;

  @ApiProperty({ type: [String] })
  bullets!: string[];

  @ApiPropertyOptional()
  imagePrompt?: string;

  @ApiPropertyOptional({
    description: 'Short-lived signed URL (never persisted)',
  })
  imageUrl?: string;
}

export class PresentationSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  topic!: string;

  @ApiProperty()
  slideCount!: number;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class PresentationDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  topic!: string;

  @ApiProperty()
  style!: string;

  @ApiPropertyOptional()
  audience?: string;

  @ApiProperty()
  slideCount!: number;

  @ApiProperty({ type: [PresentationSlideDto] })
  slides!: PresentationSlideDto[];

  @ApiProperty()
  version!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class ListPresentationsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  profileId?: string;
}

@Injectable()
export class PresentationsService {
  constructor(
    @Inject(PRESENTATION_REPOSITORY)
    private readonly presentations: PresentationRepository,
    @Inject(BOOK_STORAGE) private readonly storage: BookStorage,
    private readonly configService: ConfigService,
  ) {}

  async list(
    userId: string,
    profileId?: string,
  ): Promise<PresentationSummaryDto[]> {
    const presentations = await this.presentations.listByUser(
      userId,
      profileId,
    );

    return presentations.map(toSummaryDto);
  }

  async get(
    presentationId: string,
    userId: string,
  ): Promise<PresentationDetailDto> {
    const presentation = await this.presentations.findById(
      presentationId,
      userId,
    );

    if (!presentation) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Presentation not found');
    }

    return this.toDetailDto(presentation);
  }

  async remove(presentationId: string, userId: string): Promise<void> {
    const deleted = await this.presentations.softDelete(presentationId, userId);

    if (!deleted) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Presentation not found');
    }
  }

  private async toDetailDto(
    presentation: StoredPresentation,
  ): Promise<PresentationDetailDto> {
    const ttlSeconds =
      this.configService.get<number>('BOOK_IMAGE_SIGNED_URL_TTL_SECONDS') ??
      DEFAULT_SIGNED_URL_TTL_SECONDS;

    const slides: PresentationSlideDto[] = [];
    for (const slide of presentation.version.slides) {
      slides.push({
        title: slide.title,
        bullets: slide.bullets,
        imagePrompt: slide.imagePrompt,
        imageUrl: slide.imagePath
          ? await this.storage.signedUrl(slide.imagePath, ttlSeconds)
          : undefined,
      });
    }

    return {
      id: presentation.id,
      title: presentation.title,
      topic: presentation.version.topic,
      style: presentation.version.style,
      audience: presentation.version.audience,
      slideCount: presentation.version.slideCount,
      slides,
      version: presentation.currentVersion,
      createdAt: presentation.createdAt.toISOString(),
      updatedAt: presentation.updatedAt.toISOString(),
    };
  }
}

function toSummaryDto(
  summary: StoredPresentationSummary,
): PresentationSummaryDto {
  return {
    id: summary.id,
    title: summary.title,
    topic: summary.topic,
    slideCount: summary.slideCount,
    version: summary.currentVersion,
    createdAt: summary.createdAt.toISOString(),
    updatedAt: summary.updatedAt.toISOString(),
  };
}
