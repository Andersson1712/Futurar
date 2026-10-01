export type ImageSize = '1K' | '2K' | '4K';

export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio?: string;
  imageSize?: ImageSize;
  tenantId?: string;
}

export interface ImageGenerationResult {
  data: Buffer;
  mimeType: string;
  model: string;
}

export interface ImageGeneratorPort {
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
