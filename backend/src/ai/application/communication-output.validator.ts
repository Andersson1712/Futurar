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
  CommunicationAudience,
  CommunicationCellCount,
} from '../domain/communication-generation.types';

export const COMMUNICATION_LIMITS = {
  maxTitleChars: 80,
  maxLabelChars: 40,
  maxImagePromptChars: 300,
} as const;

const COMMON_BLOCKED_TERMS = [
  'pornografia',
  'pedofilia',
  'abuso sexual',
  'violacion',
];

const BLOCKED_TERMS: Record<CommunicationAudience, readonly string[]> = {
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

class GeneratedCellDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMUNICATION_LIMITS.maxLabelChars)
  label!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMUNICATION_LIMITS.maxImagePromptChars)
  imagePrompt!: string;
}

class GeneratedCommunicationPayloadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMUNICATION_LIMITS.maxTitleChars)
  title!: string;

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => GeneratedCellDto)
  cells!: GeneratedCellDto[];

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export interface GeneratedCellDtoShape {
  label: string;
  imagePrompt: string;
}

export interface GeneratedCommunicationDto {
  title: string;
  cells: GeneratedCellDtoShape[];
  imageUrl?: string;
}

export interface CommunicationInputToModerate {
  kind: string;
  topic: string;
  style: string;
}

@Injectable()
export class CommunicationOutputValidator {
  validate(
    payload: unknown,
    audience: CommunicationAudience,
    cellCount: CommunicationCellCount,
  ): GeneratedCommunicationDto {
    if (typeof payload !== 'object' || payload === null) {
      throw invalidCommunicationOutput();
    }

    const dto = plainToInstance(GeneratedCommunicationPayloadDto, payload);
    const errors = validateSync(dto, {
      skipMissingProperties: false,
      forbidUnknownValues: true,
      whitelist: true,
    });

    if (errors.length > 0) {
      throw invalidCommunicationOutput();
    }

    if (dto.cells.length !== cellCount) {
      throw invalidCommunicationOutput();
    }

    this.assertNoBlockedTerms(
      [
        dto.title,
        ...dto.cells.flatMap((cell) => [cell.label, cell.imagePrompt]),
      ],
      audience,
      'CONTENT_BLOCKED',
    );

    return {
      title: dto.title,
      cells: dto.cells.map((cell) => ({
        label: cell.label,
        imagePrompt: cell.imagePrompt,
      })),
      imageUrl: dto.imageUrl,
    };
  }

  assertInputAllowed(
    input: CommunicationInputToModerate,
    audience: CommunicationAudience,
  ): void {
    this.assertNoBlockedTerms(
      [input.kind, input.topic, input.style],
      audience,
      'INVALID_REQUEST',
    );
  }

  private assertNoBlockedTerms(
    parts: string[],
    audience: CommunicationAudience,
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

function invalidCommunicationOutput(): AiProviderError {
  return new AiProviderError(
    'INVALID_OUTPUT',
    'The provider returned a board that does not match the required schema',
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
