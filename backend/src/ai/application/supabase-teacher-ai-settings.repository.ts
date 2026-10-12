import type { SupabaseClient } from '@supabase/supabase-js';
import { AiErrorException } from '../../common/errors/ai-error.exception';
import type { SupabaseService } from '../../supabase/supabase.service';
import type {
  TeacherAiSettings,
  TeacherAiSettingsPreferences,
  TeacherAiSettingsRepository,
} from './teacher-ai-settings.repository';

export const TEACHER_AI_SETTINGS_TABLE = 'teacher_ai_settings';

interface TeacherAiSettingsRow {
  owner_id: string;
  text_model: string | null;
  image_model: string | null;
  updated_at: string | null;
}

interface RowResponse<T> {
  data: T | null;
  error: unknown;
}

/**
 * SPEC-033B — Supabase adapter for the per-teacher model preference.
 * The backend uses the service-role key and bypasses RLS (no policies).
 * Mirrors the Supabase credential/profile repository conventions.
 */
export class SupabaseTeacherAiSettingsRepository implements TeacherAiSettingsRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async get(ownerId: string): Promise<TeacherAiSettings | undefined> {
    const client = this.requireClient();
    const response = (await client
      .from(TEACHER_AI_SETTINGS_TABLE)
      .select()
      .eq('owner_id', ownerId)
      .maybeSingle()) as unknown as RowResponse<TeacherAiSettingsRow>;

    if (response.error || !response.data) return undefined;

    return mapRow(response.data);
  }

  async upsert(
    ownerId: string,
    preferences: TeacherAiSettingsPreferences,
  ): Promise<TeacherAiSettings> {
    const client = this.requireClient();
    const values: Record<string, unknown> = {
      owner_id: ownerId,
      updated_at: new Date().toISOString(),
    };

    // Omitted columns are not sent, so a Supabase upsert keeps the stored
    // value on conflict (single-row, last-write-wins per provided field).
    if (preferences.textModel !== undefined) {
      values.text_model = preferences.textModel;
    }
    if (preferences.imageModel !== undefined) {
      values.image_model = preferences.imageModel;
    }

    const response = (await client
      .from(TEACHER_AI_SETTINGS_TABLE)
      .upsert(values, { onConflict: 'owner_id' })
      .select()
      .single()) as unknown as RowResponse<TeacherAiSettingsRow>;

    if (response.error || !response.data) {
      throw new AiErrorException(
        503,
        'PROVIDER_UNAVAILABLE',
        'AI model settings storage is unavailable',
      );
    }

    return mapRow(response.data);
  }

  private requireClient(): SupabaseClient {
    const client = this.supabaseService.getClient();

    if (!client) {
      throw new AiErrorException(
        503,
        'PROVIDER_UNAVAILABLE',
        'AI model settings storage is not configured',
      );
    }

    return client;
  }
}

function mapRow(row: TeacherAiSettingsRow): TeacherAiSettings {
  return {
    ownerId: row.owner_id,
    textModel: row.text_model ?? undefined,
    imageModel: row.image_model ?? undefined,
    updatedAt: new Date(row.updated_at ?? Date.now()),
  };
}
