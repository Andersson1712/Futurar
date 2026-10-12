import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  validateSync,
} from 'class-validator';
import { AiProviderError } from '../ai.errors';
import type { DesignAudience } from '../domain/design-generation.types';

export const DESIGN_LIMITS = {
  maxTitleChars: 80,
  maxMessageChars: 140,
  maxImagePromptChars: 300,
} as const;

const COMMON_BLOCKED_TERMS = [
  'pornografia',
  'pedofilia',
  'abuso sexual',
  'violacion',
];

const BLOCKED_TERMS: Record<DesignAudience, readonly string[]> = {
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

class GeneratedDesignPayloadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(DESIGN_LIMITS.maxTitleChars)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(DESIGN_LIMITS.maxMessageChars)
  message!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(DESIGN_LIMITS.maxImagePromptChars)
  imagePrompt!: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export interface GeneratedDesignDto {
  title: string;
  message: string;
  imagePrompt: string;
  imageUrl?: string;
}

export interface DesignInputToModerate {
  occasion: string;
  message: string;
  style: string;
}

@Injectable()
export class DesignOutputValidator {
  validate(payload: unknown, audience: DesignAudience): GeneratedDesignDto {
    if (typeof payload !== 'object' || payload === null) {
      throw invalidDesignOutput();
    }

    const dto = plainToInstance(GeneratedDesignPayloadDto, payload);
    const errors = validateSync(dto, {
      skipMissingProperties: false,
      forbidUnknownValues: true,
      whitelist: true,
    });

    if (errors.length > 0) {
      throw invalidDesignOutput();
    }

    this.assertNoBlockedTerms(
      [dto.title, dto.message, dto.imagePrompt],
      audience,
      'CONTENT_BLOCKED',
    );

    return {
      title: dto.title,
      message: dto.message,
      imagePrompt: dto.imagePrompt,
      imageUrl: dto.imageUrl,
    };
  }

  assertInputAllowed(
    input: DesignInputToModerate,
    audience: DesignAudience,
  ): void {
    this.assertNoBlockedTerms(
      [input.occasion, input.message, input.style],
      audience,
      'INVALID_REQUEST',
    );
  }

  private assertNoBlockedTerms(
    parts: string[],
    audience: DesignAudience,
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

function invalidDesignOutput(): AiProviderError {
  return new AiProviderError(
    'INVALID_OUTPUT',
    'The provider returned a design that does not match the required schema',
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
