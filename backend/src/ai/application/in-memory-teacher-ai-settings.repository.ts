import { Injectable } from '@nestjs/common';
import type {
  TeacherAiSettings,
  TeacherAiSettingsPreferences,
  TeacherAiSettingsRepository,
} from './teacher-ai-settings.repository';

/**
 * SPEC-033B — in-memory fallback used when Supabase is not configured
 * (dev/test) or the client is unavailable, mirroring the credential
 * repository fallback. Not shared across processes.
 */
@Injectable()
export class InMemoryTeacherAiSettingsRepository implements TeacherAiSettingsRepository {
  private readonly settings = new Map<string, TeacherAiSettings>();

  get(ownerId: string): Promise<TeacherAiSettings | undefined> {
    return Promise.resolve(this.settings.get(ownerId));
  }

  upsert(
    ownerId: string,
    preferences: TeacherAiSettingsPreferences,
  ): Promise<TeacherAiSettings> {
    const existing = this.settings.get(ownerId);
    const next: TeacherAiSettings = {
      ownerId,
      textModel:
        preferences.textModel !== undefined
          ? preferences.textModel
          : existing?.textModel,
      imageModel:
        preferences.imageModel !== undefined
          ? preferences.imageModel
          : existing?.imageModel,
      updatedAt: new Date(),
    };

    this.settings.set(ownerId, next);

    return Promise.resolve(next);
  }
}
