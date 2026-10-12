import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw/server';
import { API_BASE } from '../test/msw/handlers';
import {
  COMMUNICATION_TOPIC_MAX_LENGTH,
  communicationDetailToStory,
  getStudentCommunication,
  listStudentCommunications,
  requestCommunicationGeneration,
  type CommunicationDetailPayload,
  type CommunicationSummaryPayload,
} from './backendCommunications';

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

const SAMPLE_SUMMARY: CommunicationSummaryPayload = {
  id: 'board-1',
  title: 'Mis sentimientos',
  kind: 'feelings',
  cellCount: 6,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SAMPLE_DETAIL: CommunicationDetailPayload = {
  id: 'board-1',
  title: 'Mis sentimientos',
  kind: 'feelings',
  topic: 'Cómo me siento hoy',
  style: 'Pictogramas',
  audience: 'child',
  cellCount: 6,
  cells: [
    {
      label: 'Contento',
      imageUrl: 'https://signed.example/communications/cell-0.png',
    },
    { label: 'Triste' },
  ],
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('backendCommunications (SPEC-029C)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists boards filtered by profile', async () => {
    let profileId: string | null = null;

    server.use(
      http.get(`${API_BASE}/api/v1/communications`, ({ request }) => {
        profileId = new URL(request.url).searchParams.get('profileId');

        return HttpResponse.json([SAMPLE_SUMMARY]);
      }),
    );

    const boards = await listStudentCommunications('student-1');

    expect(profileId).toBe('student-1');
    expect(boards).toEqual([SAMPLE_SUMMARY]);
  });

  it('loads a board detail by id', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/communications/:id`, () =>
        HttpResponse.json(SAMPLE_DETAIL),
      ),
    );

    const board = await getStudentCommunication('board-1');

    expect(board).toEqual(SAMPLE_DETAIL);
    expect(board.cells).toHaveLength(2);
  });

  it('requests generation with an idempotency key', async () => {
    let idempotencyKey: string | null = null;
    let body: unknown = null;

    server.use(
      http.post(`${API_BASE}/api/v1/ai/communications/generate`, async ({ request }) => {
        idempotencyKey = request.headers.get('Idempotency-Key');
        body = await request.json();

        return HttpResponse.json({ jobId: 'job-1', status: 'queued' }, { status: 202 });
      }),
    );

    const response = await requestCommunicationGeneration({
      kind: 'feelings',
      topic: 'Cómo me siento hoy',
      style: 'Pictogramas',
      cellCount: 6,
    });

    expect(response).toEqual({ jobId: 'job-1', status: 'queued' });
    expect(typeof idempotencyKey).toBe('string');
    expect(body).toMatchObject({ kind: 'feelings', cellCount: 6 });
  });

  it('maps a detail to a readable story', () => {
    const story = communicationDetailToStory(SAMPLE_DETAIL, 'student-1');

    expect(story.type).toBe('communication');
    expect(story.title).toBe('Mis sentimientos');
    expect(story.content).toContain('Celda 1: Contento');
    expect(story.image_url).toBe(
      'https://signed.example/communications/cell-0.png',
    );
  });

  it('exposes the topic length contract', () => {
    expect(COMMUNICATION_TOPIC_MAX_LENGTH).toBe(120);
  });
});
