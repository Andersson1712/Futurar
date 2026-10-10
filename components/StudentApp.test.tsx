import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentApp from './StudentApp';
import { ApiError } from '../services/backendApi';
import { listActiveProfiles } from '../services/backendProfiles';
import { requestBookGeneration } from '../services/bookGeneration';
import { messageForErrorCode, t } from '../utils/messages';
import {
  clearProgress,
  loadProgress,
  PROGRESS_STORAGE_KEY,
} from '../utils/progressStore';

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

vi.mock('../services/bookGeneration', () => ({
  requestBookGeneration: vi.fn(),
  followJob: vi.fn(),
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
    listActiveProfiles: vi.fn(async () => [PROFILE]),
    listProfileOptions: vi.fn(async () => ({
      protagonists: [
        { id: 'p1', label: 'Un dragón', icon: 'pets', isEnabled: true },
      ],
      scenarios: [
        { id: 's1', label: 'Un bosque', icon: 'forest', isEnabled: true },
      ],
      missions: [
        { id: 'm1', label: 'Una estrella', icon: 'star', isEnabled: true },
      ],
      styles: [
        { id: 'st1', label: 'Acuarela', icon: 'brush', isEnabled: true },
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

describe('StudentApp autosave (SPEC-014)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('resumes the last story and wizard step after unmounting', async () => {
    const first = render(<StudentApp onSwitchToTeacher={vi.fn()} />);

    await screen.findByText('Ana');
    fireEvent.pointerDown(optionContaining('Ana'));
    await screen.findByText(t('wizard.menuTitle'));

    await waitFor(() => {
      expect(loadProgress()?.studentId).toBe('student-1');
    });

    first.unmount();

    render(<StudentApp onSwitchToTeacher={vi.fn()} />);

    await screen.findByText(t('wizard.menuTitle'));
    expect(screen.getAllByText('Ana').length).toBeGreaterThan(0);
  });

  it('restores a mid-wizard step and maps transient GENERATING', async () => {
    clearProgress();
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({
        studentId: 'student-1',
        step: 'GENERATING',
        config: {
          protagonist: 'Un dragón',
          scenery: 'Un bosque',
          mission: 'Una estrella',
          style: 'Acuarela',
          type: 'story',
        },
        updatedAt: new Date().toISOString(),
      }),
    );

    render(<StudentApp onSwitchToTeacher={vi.fn()} />);

    await screen.findByText('Elige el Estilo Visual');
  });
});

describe('StudentApp public entry (SPEC-024)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows a localized error instead of raw backend text on failure', async () => {
    vi.mocked(listActiveProfiles).mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: 'INTERNAL', message: 'boom' }),
    );

    render(<StudentApp onSwitchToTeacher={vi.fn()} />);

    await screen.findByText(messageForErrorCode('INTERNAL'));
    expect(screen.queryByText('boom')).not.toBeInTheDocument();
  });

  it('leaves the GENERATING spinner and returns to style selection on failure', async () => {
    vi.mocked(requestBookGeneration).mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: 'INTERNAL', message: 'boom' }),
    );

    render(<StudentApp onSwitchToTeacher={vi.fn()} />);

    await screen.findByText('Ana');
    fireEvent.pointerDown(optionContaining('Ana'));
    await screen.findByText(t('wizard.menuTitle'));

    fireEvent.pointerDown(optionContaining(t('wizard.createStory')));
    await screen.findByText(t('wizard.protagonistTitle'));
    fireEvent.pointerDown(optionContaining('Un dragón'));
    await screen.findByText(t('wizard.sceneryTitle'));
    fireEvent.pointerDown(optionContaining('Un bosque'));
    await screen.findByText(t('wizard.missionTitle'));
    fireEvent.pointerDown(optionContaining('Una estrella'));
    await screen.findByText(t('wizard.styleTitle'));
    fireEvent.pointerDown(optionContaining('Acuarela'));

    await screen.findByText(t('wizard.generatingTitle'));

    await waitFor(() => {
      expect(
        screen.queryByText(t('wizard.generatingTitle')),
      ).not.toBeInTheDocument();
    });
    await screen.findByText(t('wizard.styleTitle'));
    await screen.findByText(messageForErrorCode('INTERNAL'));
  });
});
