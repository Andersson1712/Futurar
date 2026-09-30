import { Injectable } from '@nestjs/common';
import {
  BOOK_PROMPT_VERSION,
  BOOK_RESPONSE_JSON_SCHEMA,
  buildBookPrompt,
  buildBookSystemInstruction,
} from '../prompts/book/v1';
import type { BookPromptParams } from '../prompts/book/v1';
import type { BookGenerationCommand } from './book-generation.use-case';

export const BOOK_LANGUAGE = 'es-AR';
export const BOOK_TEMPERATURE = 0.8;
export const BOOK_MAX_OUTPUT_TOKENS = 16_384;

export interface BookPrompt {
  version: string;
  systemInstruction: string;
  prompt: string;
  responseJsonSchema: Record<string, unknown>;
}

@Injectable()
export class PromptBuilderService {
  build(command: BookGenerationCommand): BookPrompt {
    const params: BookPromptParams = {
      protagonist: command.protagonist,
      scenery: command.scenery,
      mission: command.mission,
      style: command.style,
      storySize: command.storySize,
      customStructure: command.customStructure,
      dedication: command.dedication,
      audience: command.audience ?? 'child',
      language: BOOK_LANGUAGE,
    };

    return {
      version: BOOK_PROMPT_VERSION,
      systemInstruction: buildBookSystemInstruction(params),
      prompt: buildBookPrompt(params),
      responseJsonSchema: BOOK_RESPONSE_JSON_SCHEMA,
    };
  }
}
