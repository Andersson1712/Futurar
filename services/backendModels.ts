import { apiFetch } from './backendApi';

/**
 * SPEC-033B — curated per-teacher AI model catalog and preference.
 * The catalog is read-only (the backend allowlist is the single source of
 * truth); the preference is stored server-side and applied per generation.
 */
export interface ModelCatalog {
  text: string[];
  image: string[];
  defaults: { text: string; image: string };
}

export interface ModelPreference {
  textModel?: string;
  imageModel?: string;
}

export async function getModelCatalog(): Promise<ModelCatalog> {
  return apiFetch<ModelCatalog>('/api/v1/ai/models');
}

export async function getModelPreference(): Promise<ModelPreference> {
  return apiFetch<ModelPreference>('/api/v1/ai/model-preferences');
}

export async function saveModelPreference(
  preference: ModelPreference,
): Promise<ModelPreference> {
  return apiFetch<ModelPreference>('/api/v1/ai/model-preferences', {
    method: 'PUT',
    body: JSON.stringify(preference),
  });
}
