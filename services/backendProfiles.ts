import { apiFetch } from './backendApi';
import type { Student, StudentSettings } from '../types/database';

export interface ProfileSettingsPayload {
  scanInterval: number;
  scanColumns: number;
  voiceFeedback: boolean;
  soundEnabled: boolean;
  sweepEnabled: boolean;
  inputMode: string;
  lineHeight: string;
  boldTitles: boolean;
  uppercase: boolean;
  voiceGender: string;
  fontSize: string;
  modules: { create: boolean; library: boolean; design: boolean };
  bookStorySize: string;
  bookAudience: string;
}

export interface ProfilePayload {
  id: string;
  teacherId: string;
  name: string;
  age?: number;
  birthdate?: string;
  avatarIcon: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  settings?: ProfileSettingsPayload;
}

export interface ProfileOptionPayload {
  id: string;
  label: string;
  icon: string;
  isEnabled: boolean;
  level?: number;
  sortOrder?: number;
}

export interface ProfileOptionsPayload {
  protagonists: ProfileOptionPayload[];
  scenarios: ProfileOptionPayload[];
  missions: ProfileOptionPayload[];
  styles: ProfileOptionPayload[];
}

export interface ProfileSettingsInput {
  scan_interval?: number;
  scan_columns?: number;
  voice_feedback?: boolean;
  sound_enabled?: boolean;
  sweep_enabled?: boolean;
  input_mode?: string;
  line_height?: string;
  bold_titles?: boolean;
  uppercase?: boolean;
  voice_gender?: string;
  font_size?: string;
  modules?: unknown;
  book_story_size?: string;
  book_audience?: string;
}

export interface ProfileInput {
  name: string;
  age?: number;
  birthdate?: string;
  avatarIcon?: string;
  notes?: string;
}

export function mapProfileToStudent(profile: ProfilePayload): Student {
  return {
    id: profile.id,
    teacher_id: profile.teacherId,
    name: profile.name,
    age: profile.age ?? null,
    birthdate: profile.birthdate ?? null,
    avatar_icon: profile.avatarIcon,
    notes: profile.notes ?? null,
    is_active: profile.isActive,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

export function mapProfileSettings(
  settings?: ProfileSettingsPayload,
): StudentSettings | null {
  if (!settings) return null;

  return {
    id: '',
    student_id: '',
    content_filter_level: null,
    max_stories_per_day: null,
    preferred_protagonists: null,
    preferred_sceneries: null,
    preferred_styles: null,
    theme: null,
    updated_at: null,
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
  };
}

export async function listProfiles(
  activeOnly = true,
): Promise<ProfilePayload[]> {
  return apiFetch<ProfilePayload[]>(
    `/api/v1/profiles?active=${activeOnly ? 'true' : 'false'}`,
  );
}

export async function getProfile(profileId: string): Promise<ProfilePayload> {
  return apiFetch<ProfilePayload>(
    `/api/v1/profiles/${encodeURIComponent(profileId)}`,
  );
}

export async function createProfile(
  input: ProfileInput,
): Promise<ProfilePayload> {
  return apiFetch<ProfilePayload>('/api/v1/profiles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateProfile(
  profileId: string,
  patch: Partial<ProfileInput> & { isActive?: boolean },
): Promise<ProfilePayload> {
  return apiFetch<ProfilePayload>(
    `/api/v1/profiles/${encodeURIComponent(profileId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
}

export async function deactivateProfile(profileId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/profiles/${encodeURIComponent(profileId)}`, {
    method: 'DELETE',
  });
}

export async function saveProfileSettings(
  profileId: string,
  settings: ProfileSettingsInput,
): Promise<ProfileSettingsPayload> {
  const body: Record<string, unknown> = {};

  if (settings.scan_interval !== undefined) body.scanInterval = settings.scan_interval;
  if (settings.scan_columns !== undefined) body.scanColumns = settings.scan_columns;
  if (settings.voice_feedback !== undefined) body.voiceFeedback = settings.voice_feedback;
  if (settings.sound_enabled !== undefined) body.soundEnabled = settings.sound_enabled;
  if (settings.sweep_enabled !== undefined) body.sweepEnabled = settings.sweep_enabled;
  if (settings.input_mode !== undefined) body.inputMode = settings.input_mode;
  if (settings.line_height !== undefined) body.lineHeight = settings.line_height;
  if (settings.bold_titles !== undefined) body.boldTitles = settings.bold_titles;
  if (settings.uppercase !== undefined) body.uppercase = settings.uppercase;
  if (settings.voice_gender !== undefined) body.voiceGender = settings.voice_gender;
  if (settings.font_size !== undefined) body.fontSize = settings.font_size;
  if (settings.modules !== undefined) body.modules = settings.modules;
  if (settings.book_story_size !== undefined) body.bookStorySize = settings.book_story_size;
  if (settings.book_audience !== undefined) body.bookAudience = settings.book_audience;

  return apiFetch<ProfileSettingsPayload>(
    `/api/v1/profiles/${encodeURIComponent(profileId)}/settings`,
    { method: 'PUT', body: JSON.stringify(body) },
  );
}

export async function listProfileOptions(
  profileId: string,
): Promise<ProfileOptionsPayload> {
  return apiFetch<ProfileOptionsPayload>(
    `/api/v1/profiles/${encodeURIComponent(profileId)}/options`,
  );
}
