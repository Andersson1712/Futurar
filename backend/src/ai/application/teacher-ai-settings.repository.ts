/**
 * SPEC-033B — per-teacher AI model preference storage (curated catalog).
 *
 * One row per owner (`owner_id` unique); `text_model` / `image_model` are
 * nullable so a row may carry only one choice. The backend owns this table
 * (service-role key, RLS on, no public policies) — same access model as
 * `ai_credentials` (SPEC-020).
 */
export const TEACHER_AI_SETTINGS_REPOSITORY = Symbol(
  'TEACHER_AI_SETTINGS_REPOSITORY',
);

export interface TeacherAiSettings {
  ownerId: string;
  textModel?: string;
  imageModel?: string;
  updatedAt: Date;
}

/**
 * Patch accepted by `upsert`. Omitted fields preserve the stored value
 * (Supabase upsert only updates the columns present in the payload).
 */
export interface TeacherAiSettingsPreferences {
  textModel?: string;
  imageModel?: string;
}

export interface TeacherAiSettingsRepository {
  get(ownerId: string): Promise<TeacherAiSettings | undefined>;
  upsert(
    ownerId: string,
    preferences: TeacherAiSettingsPreferences,
  ): Promise<TeacherAiSettings>;
}
