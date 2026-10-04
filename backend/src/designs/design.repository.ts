export const DESIGN_REPOSITORY = Symbol('DESIGN_REPOSITORY');

export interface DesignSnapshot {
  title: string;
  message: string;
  occasion: string;
  style: string;
  audience?: string;
  imagePath?: string;
  imagePrompt?: string;
}

export interface DesignAudit {
  promptVersion: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  generationJobId?: string;
  createdBy: string;
}

export interface StoredDesignVersion extends DesignSnapshot {
  version: number;
  audit: DesignAudit;
  createdAt: Date;
}

export interface StoredDesignSummary {
  id: string;
  userId: string;
  profileId?: string;
  title: string;
  occasion: string;
  currentVersion: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredDesign extends StoredDesignSummary {
  version: StoredDesignVersion;
}

export interface SaveDesignInput {
  userId: string;
  profileId?: string;
  snapshot: DesignSnapshot;
  audit: DesignAudit;
}

export interface DesignRepository {
  save(input: SaveDesignInput): Promise<StoredDesign>;
  findById(designId: string, userId: string): Promise<StoredDesign | undefined>;
  listByUser(
    userId: string,
    profileId?: string,
  ): Promise<StoredDesignSummary[]>;
  softDelete(designId: string, userId: string): Promise<boolean>;
}
