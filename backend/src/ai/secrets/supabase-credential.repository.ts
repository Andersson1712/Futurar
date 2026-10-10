import type { SupabaseClient } from '@supabase/supabase-js';
import { AiErrorException } from '../../common/errors/ai-error.exception';
import type { SupabaseService } from '../../supabase/supabase.service';
import {
  CredentialMetadata,
  CredentialProvider,
  CredentialRepository,
  SaveCredentialInput,
  StoredCredential,
} from './credential.repository';

export const AI_CREDENTIALS_TABLE = 'ai_credentials';

interface CredentialRow {
  id: string;
  owner_id: string;
  tenant_id: string | null;
  provider: CredentialProvider;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_hint: string;
  status: 'active' | 'revoked';
  created_at: string;
  updated_at: string;
  rotated_at: string | null;
}

interface RowResponse<T> {
  data: T | null;
  error: unknown;
}

export class SupabaseCredentialRepository implements CredentialRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async save(input: SaveCredentialInput): Promise<CredentialMetadata> {
    const client = this.requireClient();
    const response = (await client
      .from(AI_CREDENTIALS_TABLE)
      .insert({
        owner_id: input.ownerId,
        tenant_id: input.tenantId ?? null,
        provider: input.provider,
        ciphertext: input.encrypted.ciphertext,
        iv: input.encrypted.iv,
        auth_tag: input.encrypted.authTag,
        key_hint: input.keyHint,
        status: 'active',
      })
      .select()
      .single()) as unknown as RowResponse<CredentialRow>;

    if (response.error || !response.data) {
      throw persistenceUnavailable();
    }

    // Revoke previous keys only after the new one is stored (no downtime).
    const now = new Date().toISOString();
    const revokeResponse = (await client
      .from(AI_CREDENTIALS_TABLE)
      .update({ status: 'revoked', rotated_at: now, updated_at: now })
      .eq('owner_id', input.ownerId)
      .eq('provider', input.provider)
      .eq('status', 'active')
      .neq('id', response.data.id)) as unknown as { error: unknown };

    if (revokeResponse.error) {
      throw persistenceUnavailable();
    }

    return toMetadata(response.data);
  }

  async findActive(
    ownerId: string,
    provider: CredentialProvider,
  ): Promise<StoredCredential | undefined> {
    const client = this.requireClient();
    const response = (await client
      .from(AI_CREDENTIALS_TABLE)
      .select()
      .eq('owner_id', ownerId)
      .eq('provider', provider)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()) as unknown as RowResponse<CredentialRow>;

    if (response.error || !response.data) return undefined;

    return toStored(response.data);
  }

  async list(ownerId: string): Promise<CredentialMetadata[]> {
    const client = this.requireClient();
    const response = (await client
      .from(AI_CREDENTIALS_TABLE)
      .select()
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })) as unknown as RowResponse<
      CredentialRow[]
    >;

    if (response.error || !response.data) return [];

    return response.data.map(toMetadata);
  }

  async revoke(
    ownerId: string,
    provider: CredentialProvider,
  ): Promise<boolean> {
    const client = this.requireClient();
    const response = (await client
      .from(AI_CREDENTIALS_TABLE)
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('owner_id', ownerId)
      .eq('provider', provider)
      .eq('status', 'active')
      .select()) as unknown as RowResponse<CredentialRow[]>;

    if (response.error) {
      throw persistenceUnavailable();
    }

    return (response.data?.length ?? 0) > 0;
  }

  private requireClient(): SupabaseClient {
    const client = this.supabaseService.getClient();

    if (!client) {
      throw new AiErrorException(
        503,
        'PROVIDER_UNAVAILABLE',
        'Credential storage is not configured',
      );
    }

    return client;
  }
}

function toMetadata(row: CredentialRow): CredentialMetadata {
  return {
    id: row.id,
    provider: row.provider,
    keyHint: row.key_hint,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    rotatedAt: row.rotated_at ? new Date(row.rotated_at) : undefined,
  };
}

function toStored(row: CredentialRow): StoredCredential {
  return {
    ...toMetadata(row),
    ownerId: row.owner_id,
    tenantId: row.tenant_id ?? undefined,
    encrypted: {
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.auth_tag,
    },
  };
}

function persistenceUnavailable(): AiErrorException {
  return new AiErrorException(
    503,
    'PROVIDER_UNAVAILABLE',
    'Credential storage is unavailable',
  );
}
