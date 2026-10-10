export const BOOK_REPOSITORY = Symbol('BOOK_REPOSITORY');

export const DEDICATION_POSITIONS = ['start', 'end'] as const;
export type DedicationPosition = (typeof DEDICATION_POSITIONS)[number];

export interface BookDedication {
  to: string;
  reason?: string;
  position: DedicationPosition;
}

export interface StoredPage {
  pageNumber: number;
  content: string;
  imagePrompt?: string;
  imagePath?: string;
}

export interface BookStoryConfig {
  protagonist: string;
  scenery: string;
  mission: string;
  style: string;
  storySize?: string;
  audience?: string;
}

export interface BookSnapshot {
  title: string;
  dedication?: string;
  config?: BookStoryConfig;
  pages: StoredPage[];
}

export interface BookAudit {
  promptVersion: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  // SPEC-033: per-response provider cost in USD (OpenRouter `usage.cost`).
  // Absent for providers that report no cost (Gemini default path).
  costUsd?: number;
  imageCount: number;
  generationJobId?: string;
  createdBy: string;
}

export interface StoredBookVersion extends BookSnapshot {
  version: number;
  audit: BookAudit;
  createdAt: Date;
}

export interface StoredBookSummary {
  id: string;
  userId: string;
  profileId?: string;
  title: string;
  pageCount: number;
  currentVersion: number;
  isFavorite: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredBook extends StoredBookSummary {
  version: StoredBookVersion;
  dedication?: BookDedication;
}

export interface SaveBookInput {
  userId: string;
  profileId?: string;
  snapshot: BookSnapshot;
  audit: BookAudit;
  dedication?: BookDedication;
}

export interface BookRepository {
  save(input: SaveBookInput): Promise<StoredBook>;
  findById(bookId: string, userId: string): Promise<StoredBook | undefined>;
  listByUser(userId: string, profileId?: string): Promise<StoredBookSummary[]>;
  softDelete(bookId: string, userId: string): Promise<boolean>;
  saveDedication(
    bookId: string,
    userId: string,
    dedication: BookDedication | null,
  ): Promise<StoredBook | undefined>;
  setFavorite(
    bookId: string,
    userId: string,
    isFavorite: boolean,
  ): Promise<StoredBookSummary | undefined>;
}
