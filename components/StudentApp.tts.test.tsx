import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentApp from './StudentApp';

const speak = vi.fn();

vi.mock('../utils/speech', () => ({
  speak: (...args: unknown[]) => speak(...args),
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

describe('StudentApp TTS default (SPEC-018)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('speaks option guidance when the profile has no settings row', async () => {
    render(<StudentApp onSwitchToTeacher={vi.fn()} />);

    await screen.findByText('Ana');
    fireEvent.pointerDown(optionContaining('Ana'));
    await screen.findByText('Crear Cuento');

    fireEvent.pointerDown(optionContaining('Crear Cuento'));

    expect(speak).toHaveBeenCalledWith(
      expect.stringMatching(/protagonista/i),
      expect.any(Object),
    );
  });
});
