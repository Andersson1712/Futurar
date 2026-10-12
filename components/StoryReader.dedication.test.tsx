import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StoryReader from './StoryReader';
import { t } from '../utils/messages';

vi.mock('../utils/speech', () => ({
  speak: vi.fn(),
  speakOption: vi.fn(),
  stopSpeaking: vi.fn(),
  announceBreak: vi.fn(),
  announceResume: vi.fn(),
  configureSpeechVoice: vi.fn(),
  pickSpanishVoice: vi.fn(),
}));

vi.mock('../utils/audio', () => ({
  playSelectionSound: vi.fn(),
}));

const saveBookDedication = vi.fn();
const clearBookDedication = vi.fn();
const setBookFavorite = vi.fn();

vi.mock('../services/backendBooks', () => ({
  saveBookDedication: (...args: unknown[]) => saveBookDedication(...args),
  clearBookDedication: (...args: unknown[]) => clearBookDedication(...args),
  setBookFavorite: (...args: unknown[]) => setBookFavorite(...args),
}));

vi.mock('../services/backendContacts', () => ({
  listProfileContacts: vi.fn(async () => [
    {
      id: 'contact-1',
      profileId: 'student-1',
      name: 'Ana',
      relationship: 'mamá',
      dedicationReason: 'su cumpleaños',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]),
}));

function renderReader(overrides: Record<string, unknown> = {}) {
  const onDedicationChange = vi.fn();
  const onFavoriteChange = vi.fn();

  render(
    <StoryReader
      title="La aventura del dragón"
      content={'CAPÍTULO 1\nHabía una vez un dragón curioso que buscaba una estrella.'}
      protagonist="Un dragón"
      scenery="Un bosque"
      mission="Una estrella"
      style="Acuarela"
      onClose={vi.fn()}
      onRead={vi.fn()}
      studentId="student-1"
      bookId="book-1"
      persisted
      onDedicationChange={onDedicationChange}
      onFavoriteChange={onFavoriteChange}
      {...overrides}
    />,
  );

  return { onDedicationChange, onFavoriteChange };
}

describe('StoryReader dedication and favorite (SPEC-022)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the privacy notice in the dedication dialog', () => {
    renderReader();

    fireEvent.click(screen.getByText(t('reader.dedication')));

    expect(screen.getByText(t('reader.dedicationPrivacy'))).toBeTruthy();
  });

  it('saves a dedication using a contact', async () => {
    saveBookDedication.mockResolvedValue({
      id: 'book-1',
      dedicationTo: 'Ana',
      dedicationReason: 'su cumpleaños',
      dedicationPosition: 'start',
    });

    const { onDedicationChange } = renderReader();

    fireEvent.click(screen.getByText(t('reader.dedication')));
    await screen.findByRole('dialog');

    fireEvent.click(await screen.findByText('Ana · mamá'));
    fireEvent.click(screen.getByText(t('reader.dedicationSave')));

    await waitFor(() => {
      expect(saveBookDedication).toHaveBeenCalledWith('book-1', {
        to: 'Ana',
        reason: 'su cumpleaños',
        position: 'start',
      });
    });
    expect(onDedicationChange).toHaveBeenCalledWith({
      text: 'Para Ana: su cumpleaños',
      position: 'start',
    });
  });

  it('clears an existing dedication', async () => {
    clearBookDedication.mockResolvedValue({ id: 'book-1' });

    const { onDedicationChange } = renderReader({
      dedication: 'Para Ana',
      dedicationPosition: 'start',
    });

    fireEvent.click(screen.getByText(t('reader.dedication')));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByText(t('reader.dedicationClear')));

    await waitFor(() => {
      expect(clearBookDedication).toHaveBeenCalledWith('book-1');
    });
    expect(onDedicationChange).toHaveBeenCalledWith(null);
  });

  it('toggles the favorite flag', async () => {
    setBookFavorite.mockResolvedValue({ id: 'book-1', isFavorite: true });

    const { onFavoriteChange } = renderReader();

    fireEvent.click(screen.getByText(t('reader.favoriteAdd')));

    await waitFor(() => {
      expect(setBookFavorite).toHaveBeenCalledWith('book-1', true);
    });
    expect(onFavoriteChange).toHaveBeenCalledWith(true);
  });

  it('shows the dedication in the preview', () => {
    renderReader({ dedication: 'Para Ana', dedicationPosition: 'end' });

    expect(screen.getByText('Para Ana')).toBeInTheDocument();
  });
});
