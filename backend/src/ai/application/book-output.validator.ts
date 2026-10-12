import { Injectable } from '@nestjs/common';
import { plainToInstance, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  validateSync,
} from 'class-validator';
import { AiProviderError } from '../ai.errors';
import type { Audience } from '../domain/book-generation.types';
import { GeneratedBookDto } from '../dto/generated-book.dto';

export const BOOK_LIMITS = {
  minPages: 1,
  maxPages: 15,
  maxTitleChars: 120,
  maxDedicationChars: 200,
  maxPageChars: 2000,
  maxImagePromptChars: 300,
  maxTotalChars: 20_000,
} as const;

const COMMON_BLOCKED_TERMS = [
  'pornografia',
  'pedofilia',
  'abuso sexual',
  'violacion',
];

const BLOCKED_TERMS: Record<Audience, readonly string[]> = {
  child: [
    ...COMMON_BLOCKED_TERMS,
    'muerte',
    'muerto',
    'matar',
    'sangre',
    'arma',
    'guerra',
    'violencia',
    'secuestro',
    'demonio',
    'infierno',
    'sexo',
    'desnudo',
    'droga',
    'alcohol',
    'suicidio',
  ],
  teen: [...COMMON_BLOCKED_TERMS, 'sexo', 'desnudo', 'droga', 'suicidio'],
  adult: [...COMMON_BLOCKED_TERMS],
};

class GeneratedPagePayloadDto {
  @IsInt()
  @Min(1)
  pageNumber!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(BOOK_LIMITS.maxPageChars)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(BOOK_LIMITS.maxImagePromptChars)
  imagePrompt?: string;
}

class GeneratedBookPayloadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(BOOK_LIMITS.maxTitleChars)
  title!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(BOOK_LIMITS.maxDedicationChars)
  dedication?: string;

  @IsArray()
  @ArrayMinSize(BOOK_LIMITS.minPages)
  @ArrayMaxSize(BOOK_LIMITS.maxPages)
  @ValidateNested({ each: true })
  @Type(() => GeneratedPagePayloadDto)
  pages!: GeneratedPagePayloadDto[];
}

export interface BookInputToModerate {
  protagonist: string;
  scenery: string;
  mission: string;
  customStructure?: string;
}

@Injectable()
export class BookOutputValidator {
  validate(payload: unknown, audience: Audience): GeneratedBookDto {
    if (typeof payload !== 'object' || payload === null) {
      throw invalidOutput();
    }

    const dto = plainToInstance(GeneratedBookPayloadDto, payload);
    const errors = validateSync(dto, {
      skipMissingProperties: false,
      forbidUnknownValues: true,
      whitelist: true,
    });

    if (errors.length > 0) {
      throw invalidOutput();
    }

    this.assertSequentialPages(dto.pages);
    this.assertTotalChars(dto.pages);
    this.assertNoBlockedTerms(
      [
        dto.title,
        dto.dedication ?? '',
        ...dto.pages.map((page) => `${page.content} ${page.imagePrompt ?? ''}`),
      ],
      audience,
      'CONTENT_BLOCKED',
    );

    return {
      title: dto.title,
      dedication: dto.dedication,
      totalPages: dto.pages.length,
      pages: dto.pages.map((page) => ({
        pageNumber: page.pageNumber,
        content: page.content,
        imagePrompt: page.imagePrompt,
      })),
    };
  }

  assertInputAllowed(input: BookInputToModerate, audience: Audience): void {
    this.assertNoBlockedTerms(
      [
        input.protagonist,
        input.scenery,
        input.mission,
        input.customStructure ?? '',
      ],
      audience,
      'INVALID_REQUEST',
    );
  }

  private assertSequentialPages(pages: GeneratedPagePayloadDto[]): void {
    pages.forEach((page, index) => {
      if (page.pageNumber !== index + 1) {
        throw invalidOutput();
      }
    });
  }

  private assertTotalChars(pages: GeneratedPagePayloadDto[]): void {
    const total = pages.reduce((sum, page) => sum + page.content.length, 0);

    if (total > BOOK_LIMITS.maxTotalChars) {
      throw invalidOutput();
    }
  }

  private assertNoBlockedTerms(
    parts: string[],
    audience: Audience,
    code: 'CONTENT_BLOCKED' | 'INVALID_REQUEST',
  ): void {
    const text = normalize(parts.join(' '));
    const blocked = BLOCKED_TERMS[audience]
      .map(normalize)
      .find((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`).test(text));

    if (blocked) {
      throw new AiProviderError(
        code,
        code === 'CONTENT_BLOCKED'
          ? 'The generated content violates the audience guidelines'
          : 'The request violates the content guidelines',
      );
    }
  }
}

function invalidOutput(): AiProviderError {
  return new AiProviderError(
    'INVALID_OUTPUT',
    'The provider returned a book that does not match the required schema',
  );
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
