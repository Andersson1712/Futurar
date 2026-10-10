import type { SupabaseClient } from '@supabase/supabase-js';
import { AiErrorException } from '../common/errors/ai-error.exception';
import type { SupabaseService } from '../supabase/supabase.service';
import type { Audience, StorySize } from '../ai/domain/book-generation.types';
import type {
  FontSize,
  InputMode,
  LineHeight,
  VoiceGender,
} from './profile-settings.types';
import {
  CreateProfileInput,
  DEFAULT_PROFILE_MODULES,
  Profile,
  ProfileRepository,
  ProfileSettings,
  UpdateProfileInput,
} from './profile.repository';

export const STUDENTS_TABLE = 'students';
export const STUDENT_SETTINGS_TABLE = 'student_settings';

interface StudentRow {
  id: string;
  teacher_id: string;
  name: string;
  age: number | null;
  birthdate: string | null;
  avatar_icon: string | null;
  notes: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface SettingsRow {
  student_id: string;
  scan_interval: number | null;
  scan_columns: number | null;
  voice_feedback: boolean | null;
  sound_enabled: boolean | null;
  sweep_enabled: boolean | null;
  input_mode: string | null;
  line_height: string | null;
  bold_titles: boolean | null;
  uppercase: boolean | null;
  voice_gender: string | null;
  font_size: string | null;
  modules: unknown;
  book_story_size: string | null;
  book_audience: string | null;
}

interface RowResponse<T> {
  data: T | null;
  error: unknown;
}

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async list(teacherId: string, activeOnly: boolean): Promise<Profile[]> {
    const client = this.requireClient();
    let query = client
      .from(STUDENTS_TABLE)
      .select()
      .eq('teacher_id', teacherId);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const response = (await query.order('name')) as unknown as RowResponse<
      StudentRow[]
    >;

    if (response.error || !response.data) return [];

    return Promise.all(response.data.map((row) => this.mapWithSettings(row)));
  }

  async listActive(): Promise<Profile[]> {
    const client = this.requireClient();
    const response = (await client
      .from(STUDENTS_TABLE)
      .select()
      .eq('is_active', true)
      .order('name')) as unknown as RowResponse<StudentRow[]>;

    if (response.error || !response.data) return [];

    return Promise.all(response.data.map((row) => this.mapWithSettings(row)));
  }

  async findById(
    profileId: string,
    teacherId: string,
  ): Promise<Profile | undefined> {
    const client = this.requireClient();
    const response = (await client
      .from(STUDENTS_TABLE)
      .select()
      .eq('id', profileId)
      .eq('teacher_id', teacherId)
      .maybeSingle()) as unknown as RowResponse<StudentRow>;

    if (response.error || !response.data) return undefined;

    return this.mapWithSettings(response.data);
  }

  async create(teacherId: string, input: CreateProfileInput): Promise<Profile> {
    const client = this.requireClient();
    const response = (await client
      .from(STUDENTS_TABLE)
      .insert({
        teacher_id: teacherId,
        name: input.name,
        age: input.age ?? null,
        birthdate: input.birthdate ?? null,
        avatar_icon: input.avatarIcon ?? 'person',
        notes: input.notes ?? null,
        is_active: true,
      })
      .select()
      .single()) as unknown as RowResponse<StudentRow>;

    if (response.error || !response.data) {
      throw persistenceUnavailable();
    }

    return this.mapWithSettings(response.data);
  }

  async update(
    profileId: string,
    teacherId: string,
    patch: UpdateProfileInput,
  ): Promise<Profile | undefined> {
    const client = this.requireClient();
    const values: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (patch.name !== undefined) values.name = patch.name;
    if (patch.age !== undefined) values.age = patch.age;
    if (patch.birthdate !== undefined) values.birthdate = patch.birthdate;
    if (patch.avatarIcon !== undefined) values.avatar_icon = patch.avatarIcon;
    if (patch.notes !== undefined) values.notes = patch.notes;
    if (patch.isActive !== undefined) values.is_active = patch.isActive;

    const response = (await client
      .from(STUDENTS_TABLE)
      .update(values)
      .eq('id', profileId)
      .eq('teacher_id', teacherId)
      .select()
      .maybeSingle()) as unknown as RowResponse<StudentRow>;

    if (response.error || !response.data) return undefined;

    return this.mapWithSettings(response.data);
  }

  async deactivate(profileId: string, teacherId: string): Promise<boolean> {
    const client = this.requireClient();
    const response = (await client
      .from(STUDENTS_TABLE)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', profileId)
      .eq('teacher_id', teacherId)
      .eq('is_active', true)
      .select()) as unknown as RowResponse<StudentRow[]>;

    if (response.error) {
      throw persistenceUnavailable();
    }

    return (response.data?.length ?? 0) > 0;
  }

  async getSettings(profileId: string): Promise<ProfileSettings | undefined> {
    const client = this.requireClient();
    const response = (await client
      .from(STUDENT_SETTINGS_TABLE)
      .select()
      .eq('student_id', profileId)
      .maybeSingle()) as unknown as RowResponse<SettingsRow>;

    if (response.error || !response.data) return undefined;

    return mapSettings(response.data);
  }

  async saveSettings(
    profileId: string,
    settings: ProfileSettings,
  ): Promise<ProfileSettings> {
    const client = this.requireClient();
    const response = (await client
      .from(STUDENT_SETTINGS_TABLE)
      .upsert(
        {
          student_id: profileId,
          scan_interval: settings.scanInterval,
          scan_columns: settings.scanColumns,
          voice_feedback: settings.voiceFeedback,
          sound_enabled: settings.soundEnabled,
          sweep_enabled: settings.sweepEnabled,
          input_mode: settings.inputMode,
          line_height: settings.lineHeight,
          bold_titles: settings.boldTitles,
          uppercase: settings.uppercase,
          voice_gender: settings.voiceGender,
          font_size: settings.fontSize,
          modules: settings.modules,
          book_story_size: settings.bookStorySize,
          book_audience: settings.bookAudience,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id' },
      )
      .select()
      .single()) as unknown as RowResponse<SettingsRow>;

    if (response.error || !response.data) {
      throw persistenceUnavailable();
    }

    return mapSettings(response.data);
  }

  private async mapWithSettings(row: StudentRow): Promise<Profile> {
    const settings = await this.getSettings(row.id);

    return {
      id: row.id,
      teacherId: row.teacher_id,
      name: row.name,
      age: row.age ?? undefined,
      birthdate: row.birthdate ?? undefined,
      avatarIcon: row.avatar_icon ?? 'person',
      notes: row.notes ?? undefined,
      isActive: row.is_active ?? true,
      createdAt: new Date(row.created_at ?? Date.now()),
      updatedAt: new Date(row.updated_at ?? Date.now()),
      settings,
    };
  }

  private requireClient(): SupabaseClient {
    const client = this.supabaseService.getClient();

    if (!client) {
      throw new AiErrorException(
        503,
        'PROVIDER_UNAVAILABLE',
        'Profile storage is not configured',
      );
    }

    return client;
  }
}

function mapSettings(row: SettingsRow): ProfileSettings {
  const modules =
    typeof row.modules === 'object' && row.modules !== null
      ? (row.modules as Record<string, unknown>)
      : {};

  return {
    scanInterval: row.scan_interval ?? 3000,
    scanColumns: row.scan_columns ?? 2,
    voiceFeedback: row.voice_feedback ?? true,
    soundEnabled: row.sound_enabled ?? true,
    sweepEnabled: row.sweep_enabled ?? true,
    inputMode: (row.input_mode as InputMode) ?? 'scan',
    lineHeight: (row.line_height as LineHeight) ?? 'normal',
    boldTitles: row.bold_titles ?? false,
    uppercase: row.uppercase ?? false,
    voiceGender: (row.voice_gender as VoiceGender) ?? 'auto',
    fontSize: (row.font_size as FontSize) ?? 'normal',
    modules: {
      create: modules.create !== false,
      library: modules.library !== false,
      design: modules.design !== false,
    },
    bookStorySize: (row.book_story_size as StorySize) ?? 'medium',
    bookAudience: (row.book_audience as Audience) ?? 'child',
  };
}

function persistenceUnavailable(): AiErrorException {
  return new AiErrorException(
    503,
    'PROVIDER_UNAVAILABLE',
    'Profile storage is unavailable',
  );
}

export { DEFAULT_PROFILE_MODULES };
