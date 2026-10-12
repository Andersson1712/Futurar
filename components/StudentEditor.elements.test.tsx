import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentEditor from './StudentEditor';
import { t } from '../utils/messages';
import { expectNoA11yViolations } from '../test/a11y';
import type { Student } from '../types/database';

const ACTION = {
  id: 'action-1',
  teacherId: 'teacher-1',
  code: 'create',
  label: 'Crear Cuento',
  icon: 'auto_stories',
  sortOrder: 1,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const OPTION = {
  id: 'option-1',
  actionId: 'action-1',
  code: 'protagonist',
  label: 'Protagonista',
  icon: 'face',
  optionType: 'list' as const,
  maxEnabled: 4,
  maxPerPage: 6,
  sortOrder: 1,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  items: [
    {
      id: 'item-1',
      optionId: 'option-1',
      label: 'Un dragón',
      icon: 'pets',
      level: 1,
      sortOrder: 1,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

const PROFILE_ITEM = {
  itemId: 'item-1',
  optionId: 'option-1',
  optionCode: 'protagonist',
  actionCode: 'create',
  label: 'Un dragón',
  icon: 'pets',
  level: 1,
  sortOrder: 1,
  isEnabled: true,
};

const listActions = vi.fn(async () => [ACTION]);
const listActionOptions = vi.fn(async (_actionId: string) => [OPTION]);
const listProfileItems = vi.fn(async (_profileId: string) => [PROFILE_ITEM]);
const saveProfileItems = vi.fn(
  async (
    _profileId: string,
    items: Array<{ itemId: string; isEnabled: boolean }>,
  ) => items.map((item) => ({ ...PROFILE_ITEM, ...item })),
);
const createActionItem = vi.fn(
  async (_optionId: string, _input: { label: string; icon?: string }) => ({
    ...OPTION.items[0],
    id: 'item-2',
  }),
);
const deleteActionItem = vi.fn(async (_itemId: string) => undefined);
const updateOption = vi.fn(
  async (optionId: string, patch: { maxEnabled?: number; maxPerPage?: number }) => ({
    ...OPTION,
    id: optionId,
    ...patch,
  }),
);

vi.mock('../services/backendActions', () => ({
  listActions: () => listActions(),
  listActionOptions: (actionId: string) => listActionOptions(actionId),
  listProfileItems: (profileId: string) => listProfileItems(profileId),
  saveProfileItems: (profileId: string, items: never) =>
    saveProfileItems(profileId, items),
  createActionItem: (optionId: string, input: never) =>
    createActionItem(optionId, input),
  deleteActionItem: (itemId: string) => deleteActionItem(itemId),
  updateActionItem: vi.fn(),
  createAction: vi.fn(),
  updateAction: vi.fn(),
  deleteAction: vi.fn(),
  createActionOption: vi.fn(),
  updateActionOption: vi.fn(),
  updateOption: (optionId: string, patch: never) =>
    updateOption(optionId, patch),
  deleteActionOption: vi.fn(),
  listProfileActions: vi.fn(),
  saveProfileActions: vi.fn(),
}));

const STUDENT = {
  id: 'student-1',
  teacher_id: 'teacher-1',
  name: 'Ana',
  age: 8,
  birthdate: null,
  avatar_icon: 'person',
  notes: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
} as unknown as Student;

function renderEditor() {
  return render(
    <StudentEditor
      student={STUDENT}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      iconOptions={['person']}
    />,
  );
}

describe('StudentEditor elements tab (SPEC-023)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the catalog and toggles a profile item', async () => {
    renderEditor();

    fireEvent.click(screen.getByText('Elementos de Creación'));

    await screen.findByText('Un dragón');
    expect(screen.getByText('Protagonista')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Un dragón: deshabilitar' }),
    );

    await waitFor(() => {
      expect(saveProfileItems).toHaveBeenCalledWith('student-1', [
        { itemId: 'item-1', isEnabled: false },
      ]);
    });
  });

  it('adds a new catalog item', async () => {
    renderEditor();

    fireEvent.click(screen.getByText('Elementos de Creación'));
    await screen.findByText('Un dragón');

    fireEvent.click(screen.getByText('Agregar nuevo'));
    fireEvent.change(screen.getByPlaceholderText('Nombre del elemento...'), {
      target: { value: 'Robots' },
    });
    fireEvent.click(screen.getByText('Agregar'));

    await waitFor(() => {
      expect(createActionItem).toHaveBeenCalledWith('option-1', {
        label: 'Robots',
        icon: 'smart_toy',
      });
    });
  });

  it('edits per-option quotas through the quota editor (SPEC-023C)', async () => {
    renderEditor();

    fireEvent.click(screen.getByText('Elementos de Creación'));
    await screen.findByText('Un dragón');

    const maxEnabledInput = screen.getByLabelText(t('editor.quotaMaxEnabled'));
    const maxPerPageInput = screen.getByLabelText(t('editor.quotaMaxPerPage'));

    expect(maxEnabledInput).toHaveValue(4);
    expect(maxPerPageInput).toHaveValue(6);

    fireEvent.change(maxEnabledInput, { target: { value: '6' } });
    fireEvent.click(screen.getByText(t('editor.quotaSave')));

    await waitFor(() => {
      expect(updateOption).toHaveBeenCalledWith('option-1', {
        maxEnabled: 6,
        maxPerPage: 6,
      });
    });
  });

  it('has no axe violations on the elements tab with the quota editor', async () => {
    const { container } = renderEditor();

    fireEvent.click(screen.getByText('Elementos de Creación'));
    await screen.findByText('Un dragón');
    await screen.findByText(t('editor.quotaSave'));

    await expectNoA11yViolations(container);
  });
});
