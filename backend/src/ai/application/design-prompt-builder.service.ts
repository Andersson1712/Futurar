import { Injectable } from '@nestjs/common';
import {
  DESIGN_PROMPT_VERSION,
  DESIGN_RESPONSE_JSON_SCHEMA,
  buildDesignPrompt,
  buildDesignSystemInstruction,
} from '../prompts/design/v1';
import type { DesignPromptParams } from '../prompts/design/v1';
import type { DesignGenerationCommand } from './design-generation.use-case';

export const DESIGN_LANGUAGE = 'es-AR';
export const DESIGN_TEMPERATURE = 0.8;
export const DESIGN_MAX_OUTPUT_TOKENS = 4096;

export interface DesignPrompt {
  version: string;
  systemInstruction: string;
  prompt: string;
  responseJsonSchema: Record<string, unknown>;
}

@Injectable()
export class DesignPromptBuilderService {
  build(command: DesignGenerationCommand): DesignPrompt {
    const params: DesignPromptParams = {
      occasion: command.occasion,
      message: command.message,
      style: command.style,
      audience: command.audience ?? 'child',
      language: DESIGN_LANGUAGE,
    };

    return {
      version: DESIGN_PROMPT_VERSION,
      systemInstruction: buildDesignSystemInstruction(params),
      prompt: buildDesignPrompt(params),
      responseJsonSchema: DESIGN_RESPONSE_JSON_SCHEMA,
    };
  }
}
