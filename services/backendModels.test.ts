import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw/server';
import {
  getModelCatalog,
  getModelPreference,
  saveModelPreference,
} from './backendModels';

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

describe('backendModels (SPEC-033B)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('loads the curated model catalog', async () => {
    const catalog = await getModelCatalog();

    expect(catalog.text).toContain('google/gemini-3.8-flash');
    expect(catalog.image.length).toBeGreaterThan(0);
    expect(catalog.defaults.text).toBe('google/gemini-3.8-flash');
    expect(catalog.defaults.image).toBe('google/gemini-3.1-flash-image');
  });

  it('reads the current model preference', async () => {
    const preference = await getModelPreference();

    expect(preference.textModel).toBe('google/gemini-3.8-flash');
    expect(preference.imageModel).toBe('google/gemini-3.1-flash-image');
  });

  it('round-trips a saved model preference', async () => {
    const saved = await saveModelPreference({
      textModel: 'google/gemini-3.8-flash',
      imageModel: 'openai/gpt-image-2',
    });

    expect(saved.textModel).toBe('google/gemini-3.8-flash');
    expect(saved.imageModel).toBe('openai/gpt-image-2');
  });
});
