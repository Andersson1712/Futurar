import type { GenerationVertical } from '../generation-vertical';

export interface TextGenerationRequest {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseJsonSchema?: Record<string, unknown>;
  tenantId?: string;
  // SPEC-033B: owning vertical; adapters default to 'book' when absent.
  vertical?: GenerationVertical;
}

export interface TextGenerationUsage {
  inputTokens?: number;
  outputTokens?: number;
  // SPEC-033: per-response provider cost in USD (OpenRouter `usage.cost`).
  // Absent for providers that report no cost (Gemini default path).
  costUsd?: number;
}

export interface TextGenerationResult {
  text: string;
  model: string;
  usage?: TextGenerationUsage;
}

export interface TextGeneratorPort {
  generate(request: TextGenerationRequest): Promise<TextGenerationResult>;
}
