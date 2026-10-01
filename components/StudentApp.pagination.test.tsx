import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentApp from './StudentApp';
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

vi.mock('../services/backendProfiles', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../services/backendProfiles')>();

  const PROFILE = {
    id: 'student-1',
    teacherId: 'teacher-1',
    name: 'Ana',
    avatarIcon: 'person',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    settings: {
      scanInterval: 3000,
      scanColumns: 2,
      voiceFeedback: false,
      soundEnabled: false,
      sweepEnabled: true,
      inputMode: 'scan',
      lineHeight: 'normal',
      boldTitles: false,
      uppercase: false,
      voiceGender: 'auto',
      fontSize: 'normal',
      modules: { create: true, library: true, design: false },
      bookStorySize: 'medium',
      bookAudience: 'child',
    },
  };

  return {
    ...actual,
    listProfiles: vi.fn(async () => [PROFILE]),
    listProfileOptions: vi.fn(async () => ({
      protagonists: [
        { id: 'p1', label: 'Un dragón', icon: 'pets', isEnabled: true, level: 1 },
        { id: 'p2', label: 'Un robot', icon: 'smart_toy', isEnabled: true, level: 2 },
      ],
      scenarios: [
        { id: 's1', label: 'Un bosque', icon: 'forest', isEnabled: true, level: 1 },
      ],
      missions: [
        { id: 'm1', label: 'Una estrella', icon: 'star', isEnabled: true, level: 1 },
      ],
      styles: [
        { id: 'st1', label: 'Acuarela', icon: 'brush', isEnabled: true, level: 1 },
      ],
    })),
  };
});

function optionContaining(label: string): HTMLElement {
  const element = screen.getByText(label).closest('[data-option]');

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Option ${label} not found`);
  }

  return element;
}

describe('StudentApp scan pagination (SPEC-023B)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('pages wizard options by level with a more-options target', async () => {
    render(<StudentApp onSwitchToTeacher={vi.fn()} />);

    await screen.findByText('Ana');
    fireEvent.pointerDown(optionContaining('Ana'));
    await screen.findByText(t('wizard.menuTitle'));

    fireEvent.pointerDown(optionContaining(t('wizard.createStory')));
    await screen.findByText(t('wizard.protagonistTitle'));

    expect(screen.getByText('Un dragón')).toBeInTheDocument();
    expect(screen.queryByText('Un robot')).not.toBeInTheDocument();

    fireEvent.pointerDown(optionContaining(t('wizard.moreOptions')));

    await waitFor(() => {
      expect(screen.getByText('Un robot')).toBeInTheDocument();
    });
    expect(screen.getByText(t('wizard.moreOptions'))).toBeInTheDocument();
  });
});
