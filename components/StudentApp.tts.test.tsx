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

vi.mock('../services/supabase', () => {
  const STUDENT = {
    id: 'student-1',
    name: 'Ana',
    avatar_icon: 'person',
    is_active: true,
    student_settings: [],
  };

  const OPTIONS: Record<string, unknown[]> = {
    student_protagonists: [
      { id: 'p1', label: 'Un dragón', icon: 'pets', is_enabled: true },
    ],
    student_scenarios: [
      { id: 's1', label: 'Un bosque', icon: 'forest', is_enabled: true },
    ],
    student_missions: [
      { id: 'm1', label: 'Una estrella', icon: 'star', is_enabled: true },
    ],
    student_styles: [
      { id: 'st1', label: 'Acuarela', icon: 'brush', is_enabled: true },
    ],
  };

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
    ) =>
      Promise.resolve(
        table === 'students'
          ? { data: [STUDENT], error: null }
          : { data: OPTIONS[table] ?? [], error: null },
      ).then(resolve, reject);

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
