export const COMMUNICATION_REPOSITORY = Symbol('COMMUNICATION_REPOSITORY');

export interface CommunicationCellSnapshot {
  label: string;
  imagePath?: string;
  imagePrompt?: string;
}

export interface CommunicationSnapshot {
  title: string;
  kind: string;
  topic: string;
  style: string;
  audience?: string;
  cellCount: number;
  cells: CommunicationCellSnapshot[];
}

export interface CommunicationAudit {
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

export interface StoredCommunicationVersion extends CommunicationSnapshot {
  version: number;
  audit: CommunicationAudit;
  createdAt: Date;
}

export interface StoredCommunicationSummary {
  id: string;
  userId: string;
  profileId?: string;
  title: string;
  kind: string;
  cellCount: number;
  currentVersion: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredCommunication extends StoredCommunicationSummary {
  version: StoredCommunicationVersion;
}

export interface SaveCommunicationInput {
  userId: string;
  profileId?: string;
  snapshot: CommunicationSnapshot;
  audit: CommunicationAudit;
}

export interface CommunicationRepository {
  save(input: SaveCommunicationInput): Promise<StoredCommunication>;
  findById(
    communicationId: string,
    userId: string,
  ): Promise<StoredCommunication | undefined>;
  listByUser(
    userId: string,
    profileId?: string,
  ): Promise<StoredCommunicationSummary[]>;
  softDelete(communicationId: string, userId: string): Promise<boolean>;
}
