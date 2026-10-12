import { apiFetch } from './backendApi';
import { createIdempotencyKey } from './bookGeneration';
import type { Story } from '../types/database';

export const DESIGN_OCCASIONS = [
  'event',
  'birthday',
  'announcement',
  'invitation',
  'other',
] as const;

export type DesignOccasion = (typeof DESIGN_OCCASIONS)[number];
export type DesignAudience = 'child' | 'teen' | 'adult';

export const DESIGN_MESSAGE_MAX_LENGTH = 140;

export interface DesignGenerationInput {
  occasion: DesignOccasion;
  message: string;
  style: string;
  audience?: DesignAudience;
  profileId?: string;
}

export interface DesignSummaryPayload {
  id: string;
  title: string;
  occasion: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DesignDetailPayload {
  id: string;
  title: string;
  message: string;
  occasion: string;
  style: string;
  audience?: string;
  imagePrompt?: string;
  imageUrl?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export async function listStudentDesigns(
  profileId: string,
  init: RequestInit = {},
): Promise<DesignSummaryPayload[]> {
  return apiFetch<DesignSummaryPayload[]>(
    `/api/v1/designs?profileId=${encodeURIComponent(profileId)}`,
    init,
  );
}

export async function getStudentDesign(
  designId: string,
  init: RequestInit = {},
): Promise<DesignDetailPayload> {
  return apiFetch<DesignDetailPayload>(
    `/api/v1/designs/${encodeURIComponent(designId)}`,
    init,
  );
}

export async function requestDesignGeneration(
  input: DesignGenerationInput,
  init: RequestInit = {},
): Promise<{ jobId: string; status: string }> {
  return apiFetch('/api/v1/ai/designs/generate', {
    ...init,
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey(), ...(init.headers ?? {}) },
    body: JSON.stringify(input),
  });
}

export function designSummaryToStory(
  summary: DesignSummaryPayload,
  studentId: string,
): Story {
  return {
    id: summary.id,
    title: summary.title,
    content: '',
    protagonist: summary.occasion,
    scenery: '',
    mission: '',
    style: '',
    image_url: null,
    student_id: studentId,
    type: 'design',
    created_at: summary.createdAt,
    is_favorite: false,
    dedication_to: null,
    dedication_reason: null,
    dedication_position: null,
  };
}

export function designDetailToStory(
  design: DesignDetailPayload,
  studentId: string,
): Story {
  return {
    ...designSummaryToStory(
      {
        id: design.id,
        title: design.title,
        occasion: design.occasion,
        version: design.version,
        createdAt: design.createdAt,
        updatedAt: design.updatedAt,
      },
      studentId,
    ),
    content: design.message,
    style: design.style,
    image_url: design.imageUrl ?? null,
  };
}
