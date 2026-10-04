import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw/server';
import {
  SAMPLE_ACTION,
  SAMPLE_ACTION_ITEM,
  SAMPLE_ACTION_OPTION,
  SAMPLE_PROFILE_ITEM,
} from '../test/msw/handlers';
import {
  createAction,
  createActionItem,
  deleteAction,
  deleteActionItem,
  listActionOptions,
  listActions,
  listProfileItems,
  saveProfileItems,
  updateActionItem,
  updateOption,
} from './backendActions';

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

describe('backendActions (SPEC-023)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists the action catalog with options and items', async () => {
    await expect(listActions()).resolves.toEqual([SAMPLE_ACTION]);

    const options = await listActionOptions('action-1');

    expect(options).toEqual([SAMPLE_ACTION_OPTION]);
    expect(options[0].items).toEqual([SAMPLE_ACTION_ITEM]);
  });

  it('creates and deletes catalog rows', async () => {
    const created = await createAction({
      code: 'library',
      label: 'Mi Biblioteca',
    });
    expect(created.id).toBe('action-2');

    const item = await createActionItem('option-1', { label: 'Un dragón' });
    expect(item.id).toBe('item-2');

    const updated = await updateActionItem('item-1', { label: 'Curioso' });
    expect(updated.label).toBe('Curioso');

    await expect(deleteActionItem('item-1')).resolves.toBeUndefined();
    await expect(deleteAction('action-1')).resolves.toBeUndefined();
  });

  it('lists and saves profile items', async () => {
    await expect(listProfileItems('student-1')).resolves.toEqual([
      SAMPLE_PROFILE_ITEM,
    ]);

    const saved = await saveProfileItems('student-1', [
      { itemId: 'item-1', isEnabled: false },
    ]);

    expect(saved).toEqual([
      expect.objectContaining({ itemId: 'item-1', isEnabled: false }),
    ]);
  });

  it('updates option quotas via PATCH options/:id (SPEC-023C)', async () => {
    const updated = await updateOption('option-1', {
      maxEnabled: 6,
      maxPerPage: 8,
    });

    expect(updated).toMatchObject({
      id: 'option-1',
      maxEnabled: 6,
      maxPerPage: 8,
    });
  });
});
