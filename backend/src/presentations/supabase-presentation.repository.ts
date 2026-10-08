import type { SupabaseClient } from '@supabase/supabase-js';
import { AiErrorException } from '../common/errors/ai-error.exception';
import type { SupabaseService } from '../supabase/supabase.service';
import {
  PresentationRepository,
  PresentationSlideSnapshot,
  SavePresentationInput,
  StoredPresentation,
  StoredPresentationSummary,
  StoredPresentationVersion,
} from './presentation.repository';

export const PRESENTATIONS_TABLE = 'presentations';
export const PRESENTATION_VERSIONS_TABLE = 'presentation_versions';

interface PresentationRow {
  id: string;
  user_id: string;
  profile_id: string | null;
  title: string;
  topic: string;
  style: string;
  audience: string | null;
  slide_count: number;
  current_version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PresentationVersionRow {
  presentation_id: string;
  version: number;
  title: string;
  topic: string;
  style: string;
  audience: string | null;
  slide_count: number;
  slides: PresentationSlideSnapshot[];
  prompt_version: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd?: number | null;
  generation_job_id: string | null;
  created_by: string;
  created_at: string;
}

interface RowResponse<T> {
  data: T | null;
  error: unknown;
}

type PresentationsClient = SupabaseClient;

export class SupabasePresentationRepository implements PresentationRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async save(input: SavePresentationInput): Promise<StoredPresentation> {
    const jobId = input.audit.generationJobId;

    if (jobId) {
      const existing = await this.findByGenerationJob(jobId);

      if (existing) return existing;
    }

    const client = this.requireClient();
    const presentationResponse = (await client
      .from(PRESENTATIONS_TABLE)
      .insert({
        user_id: input.userId,
        profile_id: input.profileId ?? null,
        title: input.snapshot.title,
        topic: input.snapshot.topic,
        style: input.snapshot.style,
        audience: input.snapshot.audience ?? null,
        slide_count: input.snapshot.slideCount,
        current_version: 1,
      })
      .select()
      .single()) as unknown as RowResponse<PresentationRow>;

    if (presentationResponse.error || !presentationResponse.data) {
      throw persistenceUnavailable();
    }

    const versionResponse = (await client
      .from(PRESENTATION_VERSIONS_TABLE)
      .insert({
        presentation_id: presentationResponse.data.id,
        version: 1,
        title: input.snapshot.title,
        topic: input.snapshot.topic,
        style: input.snapshot.style,
        audience: input.snapshot.audience ?? null,
        slide_count: input.snapshot.slideCount,
        slides: input.snapshot.slides,
        prompt_version: input.audit.promptVersion,
        model: input.audit.model,
        input_tokens: input.audit.inputTokens ?? null,
        output_tokens: input.audit.outputTokens ?? null,
        cost_usd: input.audit.costUsd ?? null,
        generation_job_id: input.audit.generationJobId ?? null,
        created_by: input.audit.createdBy,
      })
      .select()
      .single()) as unknown as RowResponse<PresentationVersionRow>;

    if (versionResponse.error || !versionResponse.data) {
      throw persistenceUnavailable();
    }

    return assemble(presentationResponse.data, versionResponse.data);
  }

  async findById(
    presentationId: string,
    userId: string,
  ): Promise<StoredPresentation | undefined> {
    const client = this.requireClient();
    const presentationResponse = (await client
      .from(PRESENTATIONS_TABLE)
      .select()
      .eq('id', presentationId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle()) as unknown as RowResponse<PresentationRow>;

    if (presentationResponse.error || !presentationResponse.data) {
      return undefined;
    }

    const version = await this.findVersion(client, presentationResponse.data);
    if (!version) return undefined;

    return assemble(presentationResponse.data, version);
  }

  async listByUser(
    userId: string,
    profileId?: string,
  ): Promise<StoredPresentationSummary[]> {
    const client = this.requireClient();
    let query = client
      .from(PRESENTATIONS_TABLE)
      .select()
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (profileId) {
      query = query.eq('profile_id', profileId);
    }

    const response = (await query
      .order('created_at', { ascending: false })
      .limit(100)) as unknown as RowResponse<PresentationRow[]>;

    if (response.error || !response.data) return [];

    return response.data.map(toSummary);
  }

  async softDelete(presentationId: string, userId: string): Promise<boolean> {
    const client = this.requireClient();
    const response = (await client
      .from(PRESENTATIONS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', presentationId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()) as unknown as RowResponse<PresentationRow[]>;

    if (response.error) {
      throw persistenceUnavailable();
    }

    return (response.data?.length ?? 0) > 0;
  }

  private async findByGenerationJob(
    jobId: string,
  ): Promise<StoredPresentation | undefined> {
    const client = this.requireClient();
    const versionResponse = (await client
      .from(PRESENTATION_VERSIONS_TABLE)
      .select()
      .eq('generation_job_id', jobId)
      .maybeSingle()) as unknown as RowResponse<PresentationVersionRow>;

    if (versionResponse.error || !versionResponse.data) return undefined;

    const presentationResponse = (await client
      .from(PRESENTATIONS_TABLE)
      .select()
      .eq('id', versionResponse.data.presentation_id)
      .maybeSingle()) as unknown as RowResponse<PresentationRow>;

    if (presentationResponse.error || !presentationResponse.data) {
      return undefined;
    }

    return assemble(presentationResponse.data, versionResponse.data);
  }

  private async findVersion(
    client: PresentationsClient,
    presentation: PresentationRow,
  ): Promise<PresentationVersionRow | undefined> {
    const response = (await client
      .from(PRESENTATION_VERSIONS_TABLE)
      .select()
      .eq('presentation_id', presentation.id)
      .eq('version', presentation.current_version)
      .maybeSingle()) as unknown as RowResponse<PresentationVersionRow>;

    if (response.error || !response.data) return undefined;

    return response.data;
  }

  private requireClient(): PresentationsClient {
    const client = this.supabaseService.getClient();

    if (!client) {
      throw new AiErrorException(
        503,
        'PROVIDER_UNAVAILABLE',
        'Presentation persistence is not configured',
      );
    }

    return client;
  }
}

function assemble(
  presentation: PresentationRow,
  version: PresentationVersionRow,
): StoredPresentation {
  return {
    ...toSummary(presentation),
    version: toVersion(version),
  };
}

function toSummary(row: PresentationRow): StoredPresentationSummary {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id ?? undefined,
    title: row.title,
    topic: row.topic,
    slideCount: row.slide_count,
    currentVersion: row.current_version,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toVersion(row: PresentationVersionRow): StoredPresentationVersion {
  return {
    version: row.version,
    title: row.title,
    topic: row.topic,
    style: row.style,
    audience: row.audience ?? undefined,
    slideCount: row.slide_count,
    slides: row.slides,
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
    'Presentation persistence is unavailable',
  );
}
