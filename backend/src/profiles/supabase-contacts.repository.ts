import type { SupabaseClient } from '@supabase/supabase-js';
import { AiErrorException } from '../common/errors/ai-error.exception';
import type { SupabaseService } from '../supabase/supabase.service';
import {
  ContactRepository,
  CreateContactInput,
  ProfileContact,
  UpdateContactInput,
} from './contacts.repository';

export const PROFILE_CONTACTS_TABLE = 'profile_contacts';

interface ContactRow {
  id: string;
  profile_id: string;
  name: string;
  relationship: string;
  dedication_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface RowResponse<T> {
  data: T | null;
  error: unknown;
}

export class SupabaseContactRepository implements ContactRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async list(profileId: string): Promise<ProfileContact[]> {
    const client = this.requireClient();
    const response = (await client
      .from(PROFILE_CONTACTS_TABLE)
      .select()
      .eq('profile_id', profileId)
      .order('name')) as unknown as RowResponse<ContactRow[]>;

    if (response.error || !response.data) return [];

    return response.data.map(mapContact);
  }

  async findById(contactId: string): Promise<ProfileContact | undefined> {
    const client = this.requireClient();
    const response = (await client
      .from(PROFILE_CONTACTS_TABLE)
      .select()
      .eq('id', contactId)
      .maybeSingle()) as unknown as RowResponse<ContactRow>;

    if (response.error || !response.data) return undefined;

    return mapContact(response.data);
  }

  async create(
    profileId: string,
    input: CreateContactInput,
  ): Promise<ProfileContact> {
    const client = this.requireClient();
    const response = (await client
      .from(PROFILE_CONTACTS_TABLE)
      .insert({
        profile_id: profileId,
        name: input.name,
        relationship: input.relationship,
        dedication_reason: input.dedicationReason ?? null,
      })
      .select()
      .single()) as unknown as RowResponse<ContactRow>;

    if (response.error || !response.data) {
      throw persistenceUnavailable();
    }

    return mapContact(response.data);
  }

  async update(
    contactId: string,
    patch: UpdateContactInput,
  ): Promise<ProfileContact | undefined> {
    const client = this.requireClient();
    const values: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (patch.name !== undefined) values.name = patch.name;
    if (patch.relationship !== undefined)
      values.relationship = patch.relationship;
    if (patch.dedicationReason !== undefined) {
      values.dedication_reason = patch.dedicationReason;
    }

    const response = (await client
      .from(PROFILE_CONTACTS_TABLE)
      .update(values)
      .eq('id', contactId)
      .select()
      .maybeSingle()) as unknown as RowResponse<ContactRow>;

    if (response.error || !response.data) return undefined;

    return mapContact(response.data);
  }

  async remove(contactId: string): Promise<boolean> {
    const client = this.requireClient();
    const response = (await client
      .from(PROFILE_CONTACTS_TABLE)
      .delete()
      .eq('id', contactId)
      .select()) as unknown as RowResponse<ContactRow[]>;

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
        'Contact storage is not configured',
      );
    }

    return client;
  }
}

function mapContact(row: ContactRow): ProfileContact {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    relationship: row.relationship,
    dedicationReason: row.dedication_reason ?? undefined,
    createdAt: new Date(row.created_at ?? Date.now()),
    updatedAt: new Date(row.updated_at ?? Date.now()),
  };
}

function persistenceUnavailable(): AiErrorException {
  return new AiErrorException(
    503,
    'PROVIDER_UNAVAILABLE',
    'Contact storage is unavailable',
  );
}
