import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw/server';
import { API_BASE } from '../test/msw/handlers';
import { t } from '../utils/messages';
import ApiKeyPanel from './ApiKeyPanel';

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'token-1' } },
      }),
      refreshSession: vi.fn(),
    },
  },
}));

const API_KEY = 'AIzaSyTestKey1234567890abcdefg';

const ACTIVE = {
  provider: 'gemini',
  keyHint: 'defg',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ApiKeyPanel (SPEC-020)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state and saves a key without revealing it', async () => {
    let stored: (typeof ACTIVE)[] = [];

    server.use(
      http.get(`${API_BASE}/api/v1/ai/credentials`, () =>
        HttpResponse.json(stored),
      ),
      http.put(`${API_BASE}/api/v1/ai/credentials/:provider`, async ({ request }) => {
        const body = (await request.json()) as { apiKey: string };
        stored = [{ ...ACTIVE, keyHint: body.apiKey.slice(-4) }];

        return HttpResponse.json(stored[0]);
      }),
    );

    const user = userEvent.setup();
    render(<ApiKeyPanel />);

    await screen.findByText(t('credentials.none'));

    const input = screen.getByLabelText(t('credentials.save'));
    await user.type(input, API_KEY);
    await user.click(screen.getByRole('button', { name: t('credentials.save') }));

    await screen.findByText(t('credentials.saved'));
    expect(screen.getByText('••••defg')).toBeInTheDocument();
    expect(screen.queryByDisplayValue(API_KEY)).not.toBeInTheDocument();
  });

  it('revokes the active credential', async () => {
    let stored: (typeof ACTIVE)[] = [ACTIVE];

    server.use(
      http.get(`${API_BASE}/api/v1/ai/credentials`, () =>
        HttpResponse.json(stored),
      ),
      http.delete(`${API_BASE}/api/v1/ai/credentials/:provider`, () => {
        stored = [];

        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    render(<ApiKeyPanel />);

    await screen.findByText('••••defg');
    await user.click(screen.getByRole('button', { name: t('credentials.revoke') }));

    await screen.findByText(t('credentials.revoked'));
    expect(screen.getByText(t('credentials.none'))).toBeInTheDocument();
  });

  it('shows a clear message when credential management is disabled', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/ai/credentials`, () =>
        HttpResponse.json(
          {
            statusCode: 503,
            code: 'PROVIDER_UNAVAILABLE',
            message: 'Credential management is disabled',
          },
          { status: 503 },
        ),
      ),
    );

    render(<ApiKeyPanel />);

    await waitFor(() => {
      expect(screen.getByText(t('credentials.disabled'))).toBeInTheDocument();
    });
  });
});
