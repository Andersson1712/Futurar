import type { SupabaseClient } from '@supabase/supabase-js';
import { AiErrorException } from '../common/errors/ai-error.exception';
import type { SupabaseService } from '../supabase/supabase.service';
import {
  DesignRepository,
  SaveDesignInput,
  StoredDesign,
  StoredDesignSummary,
  StoredDesignVersion,
} from './design.repository';

export const DESIGNS_TABLE = 'designs';
export const DESIGN_VERSIONS_TABLE = 'design_versions';

interface DesignRow {
  id: string;
  user_id: string;
  profile_id: string | null;
  title: string;
  message: string;
  occasion: string;
  style: string;
  audience: string | null;
  image_path: string | null;
  image_prompt: string | null;
  current_version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DesignVersionRow {
  design_id: string;
  version: number;
  title: string;
  message: string;
  occasion: string;
  style: string;
  audience: string | null;
  image_path: string | null;
  image_prompt: string | null;
  prompt_version: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  // SPEC-033: `cost_usd` (migration 0010). Optional on read so rows from
  // before the migration still map; writes require the migrated column.
  cost_usd?: number | null;
  generation_job_id: string | null;
  created_by: string;
  created_at: string;
}

interface RowResponse<T> {
  data: T | null;
  error: unknown;
}

type DesignsClient = SupabaseClient;

export class SupabaseDesignRepository implements DesignRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async save(input: SaveDesignInput): Promise<StoredDesign> {
    const jobId = input.audit.generationJobId;

    if (jobId) {
      const existing = await this.findByGenerationJob(jobId);

      if (existing) return existing;
    }

    const client = this.requireClient();
    const designResponse = (await client
      .from(DESIGNS_TABLE)
      .insert({
        user_id: input.userId,
        profile_id: input.profileId ?? null,
        title: input.snapshot.title,
        message: input.snapshot.message,
        occasion: input.snapshot.occasion,
        style: input.snapshot.style,
        audience: input.snapshot.audience ?? null,
        image_path: input.snapshot.imagePath ?? null,
        image_prompt: input.snapshot.imagePrompt ?? null,
        current_version: 1,
      })
      .select()
      .single()) as unknown as RowResponse<DesignRow>;

    if (designResponse.error || !designResponse.data) {
      throw persistenceUnavailable();
    }

    const versionResponse = (await client
      .from(DESIGN_VERSIONS_TABLE)
      .insert({
        design_id: designResponse.data.id,
        version: 1,
        title: input.snapshot.title,
        message: input.snapshot.message,
        occasion: input.snapshot.occasion,
        style: input.snapshot.style,
        audience: input.snapshot.audience ?? null,
        image_path: input.snapshot.imagePath ?? null,
        image_prompt: input.snapshot.imagePrompt ?? null,
        prompt_version: input.audit.promptVersion,
        model: input.audit.model,
        input_tokens: input.audit.inputTokens ?? null,
        output_tokens: input.audit.outputTokens ?? null,
        cost_usd: input.audit.costUsd ?? null,
        generation_job_id: input.audit.generationJobId ?? null,
        created_by: input.audit.createdBy,
      })
      .select()
      .single()) as unknown as RowResponse<DesignVersionRow>;

    if (versionResponse.error || !versionResponse.data) {
      throw persistenceUnavailable();
    }

    return assemble(designResponse.data, versionResponse.data);
  }

  async findById(
    designId: string,
    userId: string,
  ): Promise<StoredDesign | undefined> {
    const client = this.requireClient();
    const designResponse = (await client
      .from(DESIGNS_TABLE)
      .select()
      .eq('id', designId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle()) as unknown as RowResponse<DesignRow>;

    if (designResponse.error || !designResponse.data) return undefined;

    const version = await this.findVersion(client, designResponse.data);
    if (!version) return undefined;

    return assemble(designResponse.data, version);
  }

  async listByUser(
    userId: string,
    profileId?: string,
  ): Promise<StoredDesignSummary[]> {
    const client = this.requireClient();
    let query = client
      .from(DESIGNS_TABLE)
      .select()
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (profileId) {
      query = query.eq('profile_id', profileId);
    }

    const response = (await query
      .order('created_at', { ascending: false })
      .limit(100)) as unknown as RowResponse<DesignRow[]>;

    if (response.error || !response.data) return [];

    return response.data.map(toSummary);
  }

  async softDelete(designId: string, userId: string): Promise<boolean> {
    const client = this.requireClient();
    const response = (await client
      .from(DESIGNS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', designId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()) as unknown as RowResponse<DesignRow[]>;

    if (response.error) {
      throw persistenceUnavailable();
    }

    return (response.data?.length ?? 0) > 0;
  }

  private async findByGenerationJob(
    jobId: string,
  ): Promise<StoredDesign | undefined> {
    const client = this.requireClient();
    const versionResponse = (await client
      .from(DESIGN_VERSIONS_TABLE)
      .select()
      .eq('generation_job_id', jobId)
      .maybeSingle()) as unknown as RowResponse<DesignVersionRow>;

    if (versionResponse.error || !versionResponse.data) return undefined;

    const designResponse = (await client
      .from(DESIGNS_TABLE)
      .select()
      .eq('id', versionResponse.data.design_id)
      .maybeSingle()) as unknown as RowResponse<DesignRow>;

    if (designResponse.error || !designResponse.data) return undefined;

    return assemble(designResponse.data, versionResponse.data);
  }

  private async findVersion(
    client: DesignsClient,
    design: DesignRow,
  ): Promise<DesignVersionRow | undefined> {
    const response = (await client
      .from(DESIGN_VERSIONS_TABLE)
      .select()
      .eq('design_id', design.id)
      .eq('version', design.current_version)
      .maybeSingle()) as unknown as RowResponse<DesignVersionRow>;

    if (response.error || !response.data) return undefined;

    return response.data;
  }

  private requireClient(): DesignsClient {
    const client = this.supabaseService.getClient();

    if (!client) {
      throw new AiErrorException(
        503,
        'PROVIDER_UNAVAILABLE',
        'Design persistence is not configured',
      );
    }

    return client;
  }
}

function assemble(design: DesignRow, version: DesignVersionRow): StoredDesign {
  return {
    ...toSummary(design),
    version: toVersion(version),
  };
}

function toSummary(row: DesignRow): StoredDesignSummary {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id ?? undefined,
    title: row.title,
    occasion: row.occasion,
    currentVersion: row.current_version,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toVersion(row: DesignVersionRow): StoredDesignVersion {
  return {
    version: row.version,
    title: row.title,
    message: row.message,
    occasion: row.occasion,
    style: row.style,
    audience: row.audience ?? undefined,
    imagePath: row.image_path ?? undefined,
    imagePrompt: row.image_prompt ?? undefined,
    audit: {
      promptVersion: row.prompt_version,
      model: row.model,
      inputTokens: row.input_tokens ?? undefined,
      outputTokens: row.output_tokens ?? undefined,
      costUsd: row.cost_usd ?? undefined,
      generationJobId: row.generation_job_id ?? undefined,
      createdBy: row.created_by,
    },
    createdAt: new Date(row.created_at),
  };
}

function persistenceUnavailable(): AiErrorException {
  return new AiErrorException(
    503,
    'PROVIDER_UNAVAILABLE',
    'Design persistence is unavailable',
  );
}
