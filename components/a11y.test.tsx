import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../test/a11y';
import LoginForm from './LoginForm';
import ScanningGrid from './ScanningGrid';
import StudentLibrary from './StudentLibrary';
import FloatingControls from './FloatingControls';
import GlobalConfigModal from './GlobalConfigModal';
import StoryDetails from './StoryDetails';
import { ScanSettingsProvider } from '../contexts/ScanSettingsContext';
import type { ScanOption } from '../types';

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

vi.mock('../utils/pdfGenerator', () => ({
  generateStoryPDF: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    register: vi.fn(),
    error: null,
    isLoading: false,
  }),
}));

vi.mock('../services/backendBooks', () => ({
  listStudentBooks: vi.fn().mockResolvedValue([]),
  getStudentBook: vi.fn(),
}));

vi.mock('../services/supabase', () => {
  function makeChain(): Record<string, unknown> {
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
    ) => Promise.resolve({ data: [], error: null }).then(resolve, reject);

    return chain;
  }

  return {
    supabase: {
      from: vi.fn(() => makeChain()),
      auth: {
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    },
    default: {},
  };
});

const OPTIONS: ScanOption[] = [
  { id: 'a', label: 'Opción A', icon: 'star' },
  { id: 'b', label: 'Opción B', icon: 'bolt' },
];

const STORY = {
  id: 'story-1',
  title: 'La aventura del dragón',
  content: 'Había una vez un dragón curioso.',
  protagonist: 'Un dragón',
  scenery: 'Un bosque',
  mission: 'Encontrar la estrella',
  style: 'Acuarela',
  image_url: null,
  student_id: 'student-1',
  type: 'story',
  created_at: '2026-01-01T00:00:00.000Z',
  is_favorite: false,
  dedication_to: null,
  dedication_reason: null,
  dedication_position: null,
};

describe('a11y (SPEC-016)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('LoginForm has no axe violations', async () => {
    const { container } = render(<LoginForm onSuccess={vi.fn()} />);

    await expectNoA11yViolations(container);
  });

  it('ScanningGrid has no axe violations', async () => {
    const { container } = render(
      <ScanSettingsProvider>
        <ScanningGrid options={OPTIONS} onSelect={vi.fn()} />
      </ScanSettingsProvider>,
    );

    await expectNoA11yViolations(container);
  });

  it('StudentLibrary has no axe violations', async () => {
    const { container } = render(
      <ScanSettingsProvider>
        <StudentLibrary
          studentId="student-1"
          studentName="Ana"
          onSelectStory={vi.fn()}
          onBack={vi.fn()}
        />
      </ScanSettingsProvider>,
    );

    await screen.findByText(/biblioteca está vacía/i);
    await expectNoA11yViolations(container);
  });

  it('the open controls menu has no axe violations', async () => {
    const { container } = render(
      <ScanSettingsProvider>
        <FloatingControls onGoToMenu={vi.fn()} />
      </ScanSettingsProvider>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Controles de accesibilidad' }),
    );
    await screen.findByRole('dialog', { name: 'Controles' });

    await expectNoA11yViolations(container);
  });

  it('GlobalConfigModal has no axe violations', async () => {
    const { container } = render(
      <GlobalConfigModal onClose={vi.fn()} teacherId="teacher-1" />,
    );

    await screen.findByRole('dialog', { name: 'Configuración de Cuentos' });
    await expectNoA11yViolations(container);
  });

  it('the dedication dialog has no axe violations', async () => {
    const { container } = render(
      <ScanSettingsProvider>
        <StoryDetails
          story={STORY}
          persisted
          onBack={vi.fn()}
          onRead={vi.fn()}
          onGoMenu={vi.fn()}
          voiceEnabled={false}
        />
      </ScanSettingsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /PDF/i }));
    await screen.findByRole('dialog', { name: 'Agregar Dedicatoria' });

    await expectNoA11yViolations(container);
  });
});
