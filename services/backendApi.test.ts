import { http, HttpResponse } from 'msw';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { server } from '../test/msw/server';
import { API_BASE } from '../test/msw/handlers';
import { ApiError, NetworkError, apiFetch } from './backendApi';

const getSession = vi.fn();
const refreshSession = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      refreshSession: (...args: unknown[]) => refreshSession(...args),
    },
  },
}));

describe('backendApi (SPEC-017)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(() => {
    getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    refreshSession.mockResolvedValue({
      data: { session: { access_token: 'token-2' } },
    });
  });
  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });
  afterAll(() => server.close());

  it('sends the Bearer token and parses JSON', async () => {
    let authorization: string | null = null;

    server.use(
      http.get(`${API_BASE}/api/v1/ping`, ({ request }) => {
        authorization = request.headers.get('Authorization');

        return HttpResponse.json({ ok: true });
      }),
    );

    await expect(apiFetch<{ ok: boolean }>('/api/v1/ping')).resolves.toEqual({
      ok: true,
    });
    expect(authorization).toBe('Bearer token-1');
  });

  it('maps backend errors to ApiError', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/nope`, () =>
        HttpResponse.json(
          {
            statusCode: 400,
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed',
            details: ['protagonist should not be empty'],
          },
          { status: 400 },
        ),
      ),
    );

    const error = await apiFetch('/api/v1/nope').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('VALIDATION_FAILED');
    expect((error as ApiError).details).toEqual([
      'protagonist should not be empty',
    ]);
  });

  it('refreshes the session once on 401 and retries', async () => {
    let attempts = 0;

    server.use(
      http.get(`${API_BASE}/api/v1/private`, ({ request }) => {
        attempts += 1;

        if (request.headers.get('Authorization') === 'Bearer token-2') {
          return HttpResponse.json({ ok: true });
        }

        return HttpResponse.json(
          { statusCode: 401, code: 'UNAUTHORIZED', message: 'expired' },
          { status: 401 },
        );
      }),
    );

    await expect(apiFetch<{ ok: boolean }>('/api/v1/private')).resolves.toEqual(
      { ok: true },
    );
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(attempts).toBe(2);
  });

  it('throws NetworkError when the request fails at the network layer', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/down`, () => HttpResponse.error()),
    );

    await expect(apiFetch('/api/v1/down')).rejects.toBeInstanceOf(NetworkError);
  });

  it('returns undefined for 204 responses', async () => {
    server.use(
      http.delete(
        `${API_BASE}/api/v1/books/book-1`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await expect(
      apiFetch('/api/v1/books/book-1', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });
});
