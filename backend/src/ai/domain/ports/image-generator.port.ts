export type ImageSize = '1K' | '2K' | '4K';

export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio?: string;
  imageSize?: ImageSize;
  tenantId?: string;
}

export interface ImageGenerationUsage {
  // SPEC-033: per-response provider cost in USD. Absent for providers
  // that report no cost (Gemini default path).
  costUsd?: number;
}

export interface ImageGenerationResult {
  data: Buffer;
  mimeType: string;
  model: string;
  usage?: ImageGenerationUsage;
}

export interface ImageGeneratorPort {
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
