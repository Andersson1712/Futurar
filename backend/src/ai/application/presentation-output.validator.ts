import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  validateSync,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AiProviderError } from '../ai.errors';
import type {
  PresentationAudience,
  PresentationSlideCount,
} from '../domain/presentation-generation.types';

export const PRESENTATION_LIMITS = {
  maxTitleChars: 80,
  maxSlideTitleChars: 80,
  maxBulletsPerSlide: 5,
  minBulletsPerSlide: 2,
  maxBulletChars: 140,
  maxImagePromptChars: 300,
} as const;

const COMMON_BLOCKED_TERMS = [
  'pornografia',
  'pedofilia',
  'abuso sexual',
  'violacion',
];

const BLOCKED_TERMS: Record<PresentationAudience, readonly string[]> = {
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

class GeneratedSlideDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRESENTATION_LIMITS.maxSlideTitleChars)
  title!: string;

  @IsArray()
  @ArrayMinSize(PRESENTATION_LIMITS.minBulletsPerSlide)
  @ArrayMaxSize(PRESENTATION_LIMITS.maxBulletsPerSlide)
  @IsString({ each: true })
  @MaxLength(PRESENTATION_LIMITS.maxBulletChars, { each: true })
  bullets!: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(PRESENTATION_LIMITS.maxImagePromptChars)
  imagePrompt!: string;
}

class GeneratedPresentationPayloadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRESENTATION_LIMITS.maxTitleChars)
  title!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeneratedSlideDto)
  slides!: GeneratedSlideDto[];

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export interface GeneratedSlideDtoShape {
  title: string;
  bullets: string[];
  imagePrompt: string;
}

export interface GeneratedPresentationDto {
  title: string;
  slides: GeneratedSlideDtoShape[];
  imageUrl?: string;
}

export interface PresentationInputToModerate {
  topic: string;
  style: string;
}

@Injectable()
export class PresentationOutputValidator {
  validate(
    payload: unknown,
    audience: PresentationAudience,
    slideCount: PresentationSlideCount,
  ): GeneratedPresentationDto {
    if (typeof payload !== 'object' || payload === null) {
      throw invalidPresentationOutput();
    }

    const dto = plainToInstance(GeneratedPresentationPayloadDto, payload);
    const errors = validateSync(dto, {
      skipMissingProperties: false,
      forbidUnknownValues: true,
      whitelist: true,
    });

    if (errors.length > 0) {
      throw invalidPresentationOutput();
    }

    if (dto.slides.length !== slideCount) {
      throw invalidPresentationOutput();
    }

    this.assertNoBlockedTerms(
      [
        dto.title,
        ...dto.slides.flatMap((slide) => [
          slide.title,
          ...slide.bullets,
          slide.imagePrompt,
        ]),
      ],
      audience,
      'CONTENT_BLOCKED',
    );

    return {
      title: dto.title,
      slides: dto.slides.map((slide) => ({
        title: slide.title,
        bullets: slide.bullets,
        imagePrompt: slide.imagePrompt,
      })),
      imageUrl: dto.imageUrl,
    };
  }

  assertInputAllowed(
    input: PresentationInputToModerate,
    audience: PresentationAudience,
  ): void {
    this.assertNoBlockedTerms(
      [input.topic, input.style],
      audience,
      'INVALID_REQUEST',
    );
  }

  private assertNoBlockedTerms(
    parts: string[],
    audience: PresentationAudience,
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

function invalidPresentationOutput(): AiProviderError {
  return new AiProviderError(
    'INVALID_OUTPUT',
    'The provider returned a presentation that does not match the required schema',
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
