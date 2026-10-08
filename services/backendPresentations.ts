import { apiFetch } from './backendApi';
import { createIdempotencyKey } from './bookGeneration';
import type { Story } from '../types/database';

export const PRESENTATION_SLIDE_COUNTS = [5, 8, 10] as const;

export type PresentationSlideCount =
  (typeof PRESENTATION_SLIDE_COUNTS)[number];
export type PresentationAudience = 'child' | 'teen' | 'adult';

export const PRESENTATION_TOPIC_MAX_LENGTH = 120;

export interface PresentationGenerationInput {
  topic: string;
  style: string;
  slideCount: PresentationSlideCount;
  audience?: PresentationAudience;
  profileId?: string;
}

export interface PresentationSlidePayload {
  title: string;
  bullets: string[];
  imagePrompt?: string;
  imageUrl?: string;
}

export interface PresentationSummaryPayload {
  id: string;
  title: string;
  topic: string;
  slideCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PresentationDetailPayload {
  id: string;
  title: string;
  topic: string;
  style: string;
  audience?: string;
  slideCount: number;
  slides: PresentationSlidePayload[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export async function listStudentPresentations(
  profileId: string,
  init: RequestInit = {},
): Promise<PresentationSummaryPayload[]> {
  return apiFetch<PresentationSummaryPayload[]>(
    `/api/v1/presentations?profileId=${encodeURIComponent(profileId)}`,
    init,
  );
}

export async function getStudentPresentation(
  presentationId: string,
  init: RequestInit = {},
): Promise<PresentationDetailPayload> {
  return apiFetch<PresentationDetailPayload>(
    `/api/v1/presentations/${encodeURIComponent(presentationId)}`,
    init,
  );
}

export async function requestPresentationGeneration(
  input: PresentationGenerationInput,
  init: RequestInit = {},
): Promise<{ jobId: string; status: string }> {
  return apiFetch('/api/v1/ai/presentations/generate', {
    ...init,
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey(), ...(init.headers ?? {}) },
    body: JSON.stringify(input),
  });
}

export function presentationSummaryToStory(
  summary: PresentationSummaryPayload,
  studentId: string,
): Story {
  return {
    id: summary.id,
    title: summary.title,
    content: '',
    protagonist: summary.topic,
    scenery: '',
    mission: '',
    style: '',
    image_url: null,
    student_id: studentId,
    type: 'presentation',
    created_at: summary.createdAt,
    is_favorite: false,
    dedication_to: null,
    dedication_reason: null,
    dedication_position: null,
  };
}

export function presentationDetailToStory(
  presentation: PresentationDetailPayload,
  studentId: string,
): Story {
  const firstSlideWithImage = presentation.slides.find(
    (slide) => slide.imageUrl,
  );

  return {
    ...presentationSummaryToStory(
      {
        id: presentation.id,
        title: presentation.title,
        topic: presentation.topic,
        slideCount: presentation.slideCount,
        version: presentation.version,
        createdAt: presentation.createdAt,
        updatedAt: presentation.updatedAt,
      },
      studentId,
    ),
    content: presentation.slides
      .map(
        (slide, index) =>
          `Diapositiva ${index + 1}: ${slide.title}\n${slide.bullets.join('\n')}`,
      )
      .join('\n\n'),
    style: presentation.style,
    image_url: firstSlideWithImage?.imageUrl ?? null,
  };
}
