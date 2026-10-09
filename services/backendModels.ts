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
  /**
   * SPEC-033B (D6) — whether OpenRouter is enabled on the backend. The
   * frontend renders the picker as disabled when false; this flag is owned
   * by the backend and never read from a browser env var.
   */
  openRouterEnabled: boolean;
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
