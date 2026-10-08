import { Injectable } from '@nestjs/common';
import {
  COMMUNICATION_PROMPT_VERSION,
  COMMUNICATION_RESPONSE_JSON_SCHEMA,
  buildCommunicationPrompt,
  buildCommunicationSystemInstruction,
} from '../prompts/communication/v1';
import type { CommunicationPromptParams } from '../prompts/communication/v1';
import type { CommunicationGenerationCommand } from './communication-generation.use-case';

export const COMMUNICATION_LANGUAGE = 'es-AR';
export const COMMUNICATION_TEMPERATURE = 0.8;
export const COMMUNICATION_MAX_OUTPUT_TOKENS = 4096;

export interface CommunicationPrompt {
  version: string;
  systemInstruction: string;
  prompt: string;
  responseJsonSchema: Record<string, unknown>;
}

@Injectable()
export class CommunicationPromptBuilderService {
  build(command: CommunicationGenerationCommand): CommunicationPrompt {
    const params: CommunicationPromptParams = {
      kind: command.kind,
      topic: command.topic,
      style: command.style,
      audience: command.audience ?? 'child',
      cellCount: command.cellCount,
      language: COMMUNICATION_LANGUAGE,
    };

    return {
      version: COMMUNICATION_PROMPT_VERSION,
      systemInstruction: buildCommunicationSystemInstruction(params),
      prompt: buildCommunicationPrompt(params),
      responseJsonSchema: COMMUNICATION_RESPONSE_JSON_SCHEMA,
    };
  }
}
