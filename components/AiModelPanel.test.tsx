import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw/server';
import { API_BASE, SAMPLE_MODEL_CATALOG } from '../test/msw/handlers';
import { t } from '../utils/messages';
import AiModelPanel from './AiModelPanel';

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

describe('AiModelPanel (SPEC-033B)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the catalog and shows the current preference', async () => {
    render(<AiModelPanel />);

    const textSelect = (await screen.findByLabelText(
      t('models.textLabel'),
    )) as HTMLSelectElement;
    const imageSelect = screen.getByLabelText(
      t('models.imageLabel'),
    ) as HTMLSelectElement;

    expect(textSelect.value).toBe(SAMPLE_MODEL_CATALOG.defaults.text);
    expect(imageSelect.value).toBe(SAMPLE_MODEL_CATALOG.defaults.image);
    expect(
      screen.getByRole('option', { name: 'openai/gpt-image-2' }),
    ).toBeTruthy();
  });

  it('saves the selected models and confirms success', async () => {
    let saved: { textModel?: string; imageModel?: string } | null = null;

    server.use(
      http.put(
        `${API_BASE}/api/v1/ai/model-preferences`,
        async ({ request }) => {
          saved = (await request.json()) as {
            textModel?: string;
            imageModel?: string;
          };

          return HttpResponse.json({ ...SAMPLE_MODEL_CATALOG.defaults, ...saved });
        },
      ),
    );

    const user = userEvent.setup();
    render(<AiModelPanel />);

    await screen.findByLabelText(t('models.textLabel'));
    await user.selectOptions(
      screen.getByLabelText(t('models.imageLabel')),
      'openai/gpt-image-2',
    );
    await user.click(screen.getByRole('button', { name: t('models.save') }));

    await screen.findByText(t('models.saved'));
    expect(saved?.imageModel).toBe('openai/gpt-image-2');
  });

  it('shows a clear message when a model slug is rejected', async () => {
    server.use(
      http.put(`${API_BASE}/api/v1/ai/model-preferences`, () =>
        HttpResponse.json(
          {
            statusCode: 422,
            code: 'INVALID_MODEL',
            message: 'Unknown text model "retired/model"',
          },
          { status: 422 },
        ),
      ),
    );

    const user = userEvent.setup();
    render(<AiModelPanel />);

    await screen.findByLabelText(t('models.textLabel'));
    await user.click(screen.getByRole('button', { name: t('models.save') }));

    await screen.findByText(t('models.invalidModel'));
    await waitFor(() => {
      expect(screen.queryByText(t('models.saved'))).toBeNull();
    });
  });
});
