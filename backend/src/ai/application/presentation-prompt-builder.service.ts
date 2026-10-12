import { Injectable } from '@nestjs/common';
import {
  PRESENTATION_PROMPT_VERSION,
  PRESENTATION_RESPONSE_JSON_SCHEMA,
  buildPresentationPrompt,
  buildPresentationSystemInstruction,
} from '../prompts/presentation/v1';
import type { PresentationPromptParams } from '../prompts/presentation/v1';
import type { PresentationGenerationCommand } from './presentation-generation.use-case';

export const PRESENTATION_LANGUAGE = 'es-AR';
export const PRESENTATION_TEMPERATURE = 0.8;
export const PRESENTATION_MAX_OUTPUT_TOKENS = 8192;

export interface PresentationPrompt {
  version: string;
  systemInstruction: string;
  prompt: string;
  responseJsonSchema: Record<string, unknown>;
}

@Injectable()
export class PresentationPromptBuilderService {
  build(command: PresentationGenerationCommand): PresentationPrompt {
    const params: PresentationPromptParams = {
      topic: command.topic,
      style: command.style,
      audience: command.audience ?? 'child',
      slideCount: command.slideCount,
      language: PRESENTATION_LANGUAGE,
    };

    return {
      version: PRESENTATION_PROMPT_VERSION,
      systemInstruction: buildPresentationSystemInstruction(params),
      prompt: buildPresentationPrompt(params),
      responseJsonSchema: PRESENTATION_RESPONSE_JSON_SCHEMA,
    };
  }
}
