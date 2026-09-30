export interface SpeechSynthesisRequest {
  text: string;
  voiceName?: string;
  languageCode?: string;
}

export interface SpeechSynthesisResult {
  audio: Buffer;
  mimeType: string;
  model: string;
}

export interface TtsPort {
  synthesize(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResult>;
}
