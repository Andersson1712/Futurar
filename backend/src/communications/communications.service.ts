import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { DEFAULT_SIGNED_URL_TTL_SECONDS } from '../ai/application/book-persistence.service';
import { BOOK_STORAGE } from '../books/book-storage.port';
import type { BookStorage } from '../books/book-storage.port';
import { AiErrorException } from '../common/errors/ai-error.exception';
import type {
  StoredCommunication,
  StoredCommunicationSummary,
} from './communication.repository';
import { COMMUNICATION_REPOSITORY } from './communication.repository';
import type { CommunicationRepository } from './communication.repository';

export class CommunicationCellDto {
  @ApiProperty()
  label!: string;

  @ApiPropertyOptional()
  imagePrompt?: string;

  @ApiPropertyOptional({
    description: 'Short-lived signed URL (never persisted)',
  })
  imageUrl?: string;
}

export class CommunicationSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  kind!: string;

  @ApiProperty()
  cellCount!: number;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class CommunicationDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  kind!: string;

  @ApiProperty()
  topic!: string;

  @ApiProperty()
  style!: string;

  @ApiPropertyOptional()
  audience?: string;

  @ApiProperty()
  cellCount!: number;

  @ApiProperty({ type: [CommunicationCellDto] })
  cells!: CommunicationCellDto[];

  @ApiProperty()
  version!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class ListCommunicationsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  profileId?: string;
}

@Injectable()
export class CommunicationsService {
  constructor(
    @Inject(COMMUNICATION_REPOSITORY)
    private readonly communications: CommunicationRepository,
    @Inject(BOOK_STORAGE) private readonly storage: BookStorage,
    private readonly configService: ConfigService,
  ) {}

  async list(
    userId: string,
    profileId?: string,
  ): Promise<CommunicationSummaryDto[]> {
    const communications = await this.communications.listByUser(
      userId,
      profileId,
    );

    return communications.map(toSummaryDto);
  }

  async get(
    communicationId: string,
    userId: string,
  ): Promise<CommunicationDetailDto> {
    const communication = await this.communications.findById(
      communicationId,
      userId,
    );

    if (!communication) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Board not found');
    }

    return this.toDetailDto(communication);
  }

  async remove(communicationId: string, userId: string): Promise<void> {
    const deleted = await this.communications.softDelete(
      communicationId,
      userId,
    );

    if (!deleted) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Board not found');
    }
  }

  private async toDetailDto(
    communication: StoredCommunication,
  ): Promise<CommunicationDetailDto> {
    const ttlSeconds =
      this.configService.get<number>('BOOK_IMAGE_SIGNED_URL_TTL_SECONDS') ??
      DEFAULT_SIGNED_URL_TTL_SECONDS;

    const cells: CommunicationCellDto[] = [];
    for (const cell of communication.version.cells) {
      cells.push({
        label: cell.label,
        imagePrompt: cell.imagePrompt,
        imageUrl: cell.imagePath
          ? await this.storage.signedUrl(cell.imagePath, ttlSeconds)
          : undefined,
      });
    }

    return {
      id: communication.id,
      title: communication.title,
      kind: communication.version.kind,
      topic: communication.version.topic,
      style: communication.version.style,
      audience: communication.version.audience,
      cellCount: communication.version.cellCount,
      cells,
      version: communication.currentVersion,
      createdAt: communication.createdAt.toISOString(),
      updatedAt: communication.updatedAt.toISOString(),
    };
  }
}

function toSummaryDto(
  summary: StoredCommunicationSummary,
): CommunicationSummaryDto {
  return {
    id: summary.id,
    title: summary.title,
    kind: summary.kind,
    cellCount: summary.cellCount,
    version: summary.currentVersion,
    createdAt: summary.createdAt.toISOString(),
    updatedAt: summary.updatedAt.toISOString(),
  };
}
