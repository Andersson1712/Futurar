export interface TextGenerationRequest {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseJsonSchema?: Record<string, unknown>;
}

export interface TextGenerationUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface TextGenerationResult {
  text: string;
  model: string;
  usage?: TextGenerationUsage;
}

export interface TextGeneratorPort {
  generate(request: TextGenerationRequest): Promise<TextGenerationResult>;
}
