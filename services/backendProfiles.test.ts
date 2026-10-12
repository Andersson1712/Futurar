import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw/server';
import {
  API_BASE,
  SAMPLE_PROFILE,
  SAMPLE_PROFILE_OPTIONS,
  SAMPLE_PROFILE_SETTINGS,
} from '../test/msw/handlers';
import {
  createProfile,
  deactivateProfile,
  getProfile,
  listProfileOptions,
  listProfiles,
  mapProfileSettings,
  mapProfileToStudent,
  saveProfileSettings,
  updateProfile,
} from './backendProfiles';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'token-1' } },
      }),
      refreshSession: vi.fn(),
    },
  },
}));

describe('backendProfiles (SPEC-021)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists profiles with settings', async () => {
    const profiles = await listProfiles(true);

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ id: 'student-1', name: 'Ana' });
    expect(profiles[0].settings?.bookStorySize).toBe('medium');
  });

  it('gets a profile by id', async () => {
    await expect(getProfile('student-1')).resolves.toMatchObject({
      id: 'student-1',
      avatarIcon: 'person',
    });
  });

  it('creates a profile with camelCase input', async () => {
    const created = await createProfile({
      name: 'Beto',
      avatarIcon: 'face_6',
    });

    expect(created.id).toBe('student-2');
    expect(created.name).toBe('Beto');
  });

  it('updates a profile including isActive', async () => {
    const updated = await updateProfile('student-1', { isActive: false });

    expect(updated.isActive).toBe(false);
  });

  it('maps snake_case settings to camelCase payload', async () => {
    let captured: Record<string, unknown> = {};

    server.use(
      http.put(
        `${API_BASE}/api/v1/profiles/student-1/settings`,
        async ({ request }) => {
          captured = (await request.json()) as Record<string, unknown>;

          return HttpResponse.json({ ...SAMPLE_PROFILE_SETTINGS, ...captured });
        },
      ),
    );

    const saved = await saveProfileSettings('student-1', {
      scan_interval: 5000,
      book_story_size: 'long',
      book_audience: 'teen',
      modules: { create: true, library: false, design: true },
    });

    expect(captured).toMatchObject({
      scanInterval: 5000,
      bookStorySize: 'long',
      bookAudience: 'teen',
      modules: { create: true, library: false, design: true },
    });
    expect(captured).not.toHaveProperty('scan_interval');
    expect(saved.bookStorySize).toBe('long');
  });

  it('deactivates a profile', async () => {
    await expect(deactivateProfile('student-1')).resolves.toBeUndefined();
  });

  it('lists profile options', async () => {
    await expect(listProfileOptions('student-1')).resolves.toEqual(
      SAMPLE_PROFILE_OPTIONS,
    );
  });

  it('maps a profile to the legacy student shape', () => {
    expect(mapProfileToStudent(SAMPLE_PROFILE)).toMatchObject({
      id: 'student-1',
      teacher_id: 'teacher-1',
      avatar_icon: 'person',
      is_active: true,
      age: 8,
    });
  });

  it('maps settings to the legacy student_settings shape', () => {
    expect(mapProfileSettings(SAMPLE_PROFILE_SETTINGS)).toMatchObject({
      scan_interval: 3000,
      book_story_size: 'medium',
      book_audience: 'child',
      modules: { create: true, library: true, design: false },
    });
  });

  it('returns null settings when the profile has none', () => {
    expect(mapProfileSettings(undefined)).toBeNull();
  });
});
