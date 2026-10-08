export const PRESENTATION_REPOSITORY = Symbol('PRESENTATION_REPOSITORY');

export interface PresentationSlideSnapshot {
  title: string;
  bullets: string[];
  imagePath?: string;
  imagePrompt?: string;
}

export interface PresentationSnapshot {
  title: string;
  topic: string;
  style: string;
  audience?: string;
  slideCount: number;
  slides: PresentationSlideSnapshot[];
}

export interface PresentationAudit {
  promptVersion: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  // SPEC-033: per-response provider cost in USD (OpenRouter `usage.cost`).
  // Absent for providers that report no cost (Gemini default path).
  costUsd?: number;
  generationJobId?: string;
  createdBy: string;
}

export interface StoredPresentationVersion extends PresentationSnapshot {
  version: number;
  audit: PresentationAudit;
  createdAt: Date;
}

export interface StoredPresentationSummary {
  id: string;
  userId: string;
  profileId?: string;
  title: string;
  topic: string;
  slideCount: number;
  currentVersion: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredPresentation extends StoredPresentationSummary {
  version: StoredPresentationVersion;
}

export interface SavePresentationInput {
  userId: string;
  profileId?: string;
  snapshot: PresentationSnapshot;
  audit: PresentationAudit;
}

export interface PresentationRepository {
  save(input: SavePresentationInput): Promise<StoredPresentation>;
  findById(
    presentationId: string,
    userId: string,
  ): Promise<StoredPresentation | undefined>;
  listByUser(
    userId: string,
    profileId?: string,
  ): Promise<StoredPresentationSummary[]>;
  softDelete(presentationId: string, userId: string): Promise<boolean>;
}
