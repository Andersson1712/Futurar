import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentEditor from './StudentEditor';
import { t } from '../utils/messages';
import type { Student } from '../types/database';

const CONTACT = {
  id: 'contact-1',
  profileId: 'student-1',
  name: 'Ana',
  relationship: 'mamá',
  dedicationReason: 'su cumpleaños',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const listProfileContacts = vi.fn(async () => [CONTACT]);
const createProfileContact = vi.fn(
  async (_profileId: string, _input: unknown) => ({
    ...CONTACT,
    id: 'contact-2',
  }),
);
const updateProfileContact = vi.fn(
  async (_contactId: string, _patch: unknown) => ({ ...CONTACT }),
);
const deleteProfileContact = vi.fn(async (_contactId: string) => undefined);

vi.mock('../services/backendContacts', () => ({
  listProfileContacts: () => listProfileContacts(),
  createProfileContact: (profileId: string, input: unknown) =>
    createProfileContact(profileId, input),
  updateProfileContact: (contactId: string, patch: unknown) =>
    updateProfileContact(contactId, patch),
  deleteProfileContact: (contactId: string) =>
    deleteProfileContact(contactId),
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

describe('StudentEditor contacts tab (SPEC-022)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists contacts and creates a new one', async () => {
    render(
      <StudentEditor
        student={STUDENT}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        iconOptions={['person']}
      />,
    );

    fireEvent.click(screen.getByText(t('editor.contacts')));

    await screen.findByText('Ana');
    expect(screen.getByText('mamá')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Beto' } });
    fireEvent.change(inputs[1], { target: { value: 'tío' } });

    fireEvent.click(
      screen.getByRole('button', { name: t('editor.contactAdd') }),
    );

    await waitFor(() => {
      expect(createProfileContact).toHaveBeenCalledWith('student-1', {
        name: 'Beto',
        relationship: 'tío',
        dedicationReason: undefined,
      });
    });
  });

  it('deletes a contact', async () => {
    render(
      <StudentEditor
        student={STUDENT}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        iconOptions={['person']}
      />,
    );

    fireEvent.click(screen.getByText(t('editor.contacts')));
    await screen.findByText('Ana');

    fireEvent.click(
      screen.getByRole('button', {
        name: `${t('editor.contactDelete')}: Ana`,
      }),
    );

    await waitFor(() => {
      expect(deleteProfileContact).toHaveBeenCalledWith('contact-1');
    });
  });
});
