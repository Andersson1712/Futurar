import type { SupabaseClient } from '@supabase/supabase-js';
import { AiErrorException } from '../common/errors/ai-error.exception';
import type { SupabaseService } from '../supabase/supabase.service';
import {
  CommunicationCellSnapshot,
  CommunicationRepository,
  SaveCommunicationInput,
  StoredCommunication,
  StoredCommunicationSummary,
  StoredCommunicationVersion,
} from './communication.repository';

export const COMMUNICATIONS_TABLE = 'communications';
export const COMMUNICATION_VERSIONS_TABLE = 'communication_versions';

interface CommunicationRow {
  id: string;
  user_id: string;
  profile_id: string | null;
  title: string;
  kind: string;
  topic: string;
  style: string;
  audience: string | null;
  cell_count: number;
  current_version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CommunicationVersionRow {
  communication_id: string;
  version: number;
  title: string;
  kind: string;
  topic: string;
  style: string;
  audience: string | null;
  cell_count: number;
  cells: CommunicationCellSnapshot[];
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

type CommunicationsClient = SupabaseClient;

export class SupabaseCommunicationRepository implements CommunicationRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async save(input: SaveCommunicationInput): Promise<StoredCommunication> {
    const jobId = input.audit.generationJobId;

    if (jobId) {
      const existing = await this.findByGenerationJob(jobId);

      if (existing) return existing;
    }

    const client = this.requireClient();
    const communicationResponse = (await client
      .from(COMMUNICATIONS_TABLE)
      .insert({
        user_id: input.userId,
        profile_id: input.profileId ?? null,
        title: input.snapshot.title,
        kind: input.snapshot.kind,
        topic: input.snapshot.topic,
        style: input.snapshot.style,
        audience: input.snapshot.audience ?? null,
        cell_count: input.snapshot.cellCount,
        current_version: 1,
      })
      .select()
      .single()) as unknown as RowResponse<CommunicationRow>;

    if (communicationResponse.error || !communicationResponse.data) {
      throw persistenceUnavailable();
    }

    const versionResponse = (await client
      .from(COMMUNICATION_VERSIONS_TABLE)
      .insert({
        communication_id: communicationResponse.data.id,
        version: 1,
        title: input.snapshot.title,
        kind: input.snapshot.kind,
        topic: input.snapshot.topic,
        style: input.snapshot.style,
        audience: input.snapshot.audience ?? null,
        cell_count: input.snapshot.cellCount,
        cells: input.snapshot.cells,
        prompt_version: input.audit.promptVersion,
        model: input.audit.model,
        input_tokens: input.audit.inputTokens ?? null,
        output_tokens: input.audit.outputTokens ?? null,
        cost_usd: input.audit.costUsd ?? null,
        generation_job_id: input.audit.generationJobId ?? null,
        created_by: input.audit.createdBy,
      })
      .select()
      .single()) as unknown as RowResponse<CommunicationVersionRow>;

    if (versionResponse.error || !versionResponse.data) {
      throw persistenceUnavailable();
    }

    return assemble(communicationResponse.data, versionResponse.data);
  }

  async findById(
    communicationId: string,
    userId: string,
  ): Promise<StoredCommunication | undefined> {
    const client = this.requireClient();
    const communicationResponse = (await client
      .from(COMMUNICATIONS_TABLE)
      .select()
      .eq('id', communicationId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle()) as unknown as RowResponse<CommunicationRow>;

    if (communicationResponse.error || !communicationResponse.data) {
      return undefined;
    }

    const version = await this.findVersion(client, communicationResponse.data);
    if (!version) return undefined;

    return assemble(communicationResponse.data, version);
  }

  async listByUser(
    userId: string,
    profileId?: string,
  ): Promise<StoredCommunicationSummary[]> {
    const client = this.requireClient();
    let query = client
      .from(COMMUNICATIONS_TABLE)
      .select()
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (profileId) {
      query = query.eq('profile_id', profileId);
    }

    const response = (await query
      .order('created_at', { ascending: false })
      .limit(100)) as unknown as RowResponse<CommunicationRow[]>;

    if (response.error || !response.data) return [];

    return response.data.map(toSummary);
  }

  async softDelete(communicationId: string, userId: string): Promise<boolean> {
    const client = this.requireClient();
    const response = (await client
      .from(COMMUNICATIONS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', communicationId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()) as unknown as RowResponse<CommunicationRow[]>;

    if (response.error) {
      throw persistenceUnavailable();
    }

    return (response.data?.length ?? 0) > 0;
  }

  private async findByGenerationJob(
    jobId: string,
  ): Promise<StoredCommunication | undefined> {
    const client = this.requireClient();
    const versionResponse = (await client
      .from(COMMUNICATION_VERSIONS_TABLE)
      .select()
      .eq('generation_job_id', jobId)
      .maybeSingle()) as unknown as RowResponse<CommunicationVersionRow>;

    if (versionResponse.error || !versionResponse.data) return undefined;

    const communicationResponse = (await client
      .from(COMMUNICATIONS_TABLE)
      .select()
      .eq('id', versionResponse.data.communication_id)
      .maybeSingle()) as unknown as RowResponse<CommunicationRow>;

    if (communicationResponse.error || !communicationResponse.data) {
      return undefined;
    }

    return assemble(communicationResponse.data, versionResponse.data);
  }

  private async findVersion(
    client: CommunicationsClient,
    communication: CommunicationRow,
  ): Promise<CommunicationVersionRow | undefined> {
    const response = (await client
      .from(COMMUNICATION_VERSIONS_TABLE)
      .select()
      .eq('communication_id', communication.id)
      .eq('version', communication.current_version)
      .maybeSingle()) as unknown as RowResponse<CommunicationVersionRow>;

    if (response.error || !response.data) return undefined;

    return response.data;
  }

  private requireClient(): CommunicationsClient {
    const client = this.supabaseService.getClient();

    if (!client) {
      throw new AiErrorException(
        503,
        'PROVIDER_UNAVAILABLE',
        'Communication persistence is not configured',
      );
    }

    return client;
  }
}

function assemble(
  communication: CommunicationRow,
  version: CommunicationVersionRow,
): StoredCommunication {
  return {
    ...toSummary(communication),
    version: toVersion(version),
  };
}

function toSummary(row: CommunicationRow): StoredCommunicationSummary {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id ?? undefined,
    title: row.title,
    kind: row.kind,
    cellCount: row.cell_count,
    currentVersion: row.current_version,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toVersion(row: CommunicationVersionRow): StoredCommunicationVersion {
  return {
    version: row.version,
    title: row.title,
    kind: row.kind,
    topic: row.topic,
    style: row.style,
    audience: row.audience ?? undefined,
    cellCount: row.cell_count,
    cells: row.cells,
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
    'Communication persistence is unavailable',
  );
}
