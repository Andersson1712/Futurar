import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentApp from './StudentApp';
import { t } from '../utils/messages';
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

vi.mock('../services/supabase', () => {
  const STUDENT = {
    id: 'student-1',
    name: 'Ana',
    avatar_icon: 'person',
    is_active: true,
    student_settings: [
      {
        scan_interval: 3000,
        voice_feedback: false,
        sound_enabled: false,
        scan_columns: 2,
      },
    ],
  };

  const OPTIONS: Record<string, unknown[]> = {
    student_protagonists: [
      { id: 'p1', label: 'Un dragón', icon: 'pets', is_enabled: true, student_id: 'student-1' },
    ],
    student_scenarios: [
      { id: 's1', label: 'Un bosque', icon: 'forest', is_enabled: true, student_id: 'student-1' },
    ],
    student_missions: [
      { id: 'm1', label: 'Una estrella', icon: 'star', is_enabled: true, student_id: 'student-1' },
    ],
    student_styles: [
      { id: 'st1', label: 'Acuarela', icon: 'brush', is_enabled: true, student_id: 'student-1' },
    ],
  };

  function makeResult(table: string) {
    if (table === 'students') return { data: [STUDENT], error: null };

    return { data: OPTIONS[table] ?? [], error: null };
  }

  function makeChain(table: string): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    const self = () => chain;

    chain.select = vi.fn(self);
    chain.eq = vi.fn(self);
    chain.order = vi.fn(self);
    chain.insert = vi.fn(self);
    chain.update = vi.fn(self);
    chain.then = (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(makeResult(table)).then(resolve, reject);

    return chain;
  }

  return {
    supabase: {
      from: vi.fn((table: string) => makeChain(table)),
      auth: {
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    },
    default: {},
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
