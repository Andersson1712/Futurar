import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw/server';
import { API_BASE } from '../test/msw/handlers';
import {
  PRESENTATION_TOPIC_MAX_LENGTH,
  getStudentPresentation,
  listStudentPresentations,
  presentationDetailToStory,
  requestPresentationGeneration,
  type PresentationDetailPayload,
  type PresentationSummaryPayload,
} from './backendPresentations';

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

const SAMPLE_SUMMARY: PresentationSummaryPayload = {
  id: 'presentation-1',
  title: 'Los dinosaurios',
  topic: 'Los dinosaurios',
  slideCount: 5,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SAMPLE_DETAIL: PresentationDetailPayload = {
  id: 'presentation-1',
  title: 'Los dinosaurios',
  topic: 'Los dinosaurios',
  style: 'Acuarela',
  audience: 'child',
  slideCount: 5,
  slides: [
    {
      title: 'Qué son',
      bullets: ['Vivieron hace millones de años', 'Eran reptiles gigantes'],
      imageUrl: 'https://signed.example/presentations/slide-0.png',
    },
    {
      title: 'Qué comían',
      bullets: ['Algunos comían plantas', 'Otros comían carne'],
    },
  ],
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('backendPresentations (SPEC-029B)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists presentations filtered by profile', async () => {
    let profileId: string | null = null;

    server.use(
      http.get(`${API_BASE}/api/v1/presentations`, ({ request }) => {
        profileId = new URL(request.url).searchParams.get('profileId');

        return HttpResponse.json([SAMPLE_SUMMARY]);
      }),
    );

    const presentations = await listStudentPresentations('student-1');

    expect(profileId).toBe('student-1');
    expect(presentations).toEqual([SAMPLE_SUMMARY]);
  });

  it('loads a presentation detail by id', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/presentations/:id`, () =>
        HttpResponse.json(SAMPLE_DETAIL),
      ),
    );

    const presentation = await getStudentPresentation('presentation-1');

    expect(presentation).toEqual(SAMPLE_DETAIL);
    expect(presentation.slides).toHaveLength(2);
  });

  it('requests generation with an idempotency key', async () => {
    let idempotencyKey: string | null = null;
    let body: unknown = null;

    server.use(
      http.post(`${API_BASE}/api/v1/ai/presentations/generate`, async ({ request }) => {
        idempotencyKey = request.headers.get('Idempotency-Key');
        body = await request.json();

        return HttpResponse.json({ jobId: 'job-1', status: 'queued' }, { status: 202 });
      }),
    );

    const response = await requestPresentationGeneration({
      topic: 'Los dinosaurios',
      style: 'Acuarela',
      slideCount: 5,
    });

    expect(response).toEqual({ jobId: 'job-1', status: 'queued' });
    expect(typeof idempotencyKey).toBe('string');
    expect(body).toMatchObject({ topic: 'Los dinosaurios', slideCount: 5 });
  });

  it('maps a detail to a readable story', () => {
    const story = presentationDetailToStory(SAMPLE_DETAIL, 'student-1');

    expect(story.type).toBe('presentation');
    expect(story.title).toBe('Los dinosaurios');
    expect(story.content).toContain('Diapositiva 1: Qué son');
    expect(story.image_url).toBe(
      'https://signed.example/presentations/slide-0.png',
    );
  });

  it('exposes the topic length contract', () => {
    expect(PRESENTATION_TOPIC_MAX_LENGTH).toBe(120);
  });
});
