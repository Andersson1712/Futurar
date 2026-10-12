import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../test/a11y';
import StudentLibrary from './StudentLibrary';
import { listStudentBooks } from '../services/backendBooks';
import {
  getStudentDesign,
  listStudentDesigns,
} from '../services/backendDesigns';
import { ScanSettingsProvider } from '../contexts/ScanSettingsContext';

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

vi.mock('../services/backendBooks', () => ({
  listStudentBooks: vi.fn(),
  getStudentBook: vi.fn(),
}));

vi.mock('../services/backendDesigns', () => ({
  listStudentDesigns: vi.fn(),
  getStudentDesign: vi.fn(),
  designSummaryToStory: vi.fn(
    (summary: { id: string; title: string }) => ({
      id: summary.id,
      title: summary.title,
      content: '',
      protagonist: '',
      scenery: '',
      mission: '',
      style: '',
      image_url: null,
      student_id: 'student-1',
      type: 'story',
      created_at: '2026-01-01T00:00:00.000Z',
      is_favorite: false,
      dedication_to: null,
      dedication_reason: null,
      dedication_position: null,
    }),
  ),
  designDetailToStory: vi.fn(
    (design: { id: string; title: string; message: string }) => ({
      id: design.id,
      title: design.title,
      content: design.message,
      protagonist: '',
      scenery: '',
      mission: '',
      style: '',
      image_url: null,
      student_id: 'student-1',
      type: 'design',
      created_at: '2026-01-01T00:00:00.000Z',
      is_favorite: false,
      dedication_to: null,
      dedication_reason: null,
      dedication_position: null,
    }),
  ),
}));

const BOOK_SUMMARY = {
  id: 'book-1',
  title: 'La aventura del dragón',
  pageCount: 1,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const DESIGN_SUMMARY = {
  id: 'design-1',
  title: 'Mi fiesta de cumple',
  occasion: 'birthday',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function optionContaining(label: string): HTMLElement {
  const element = screen.getByText(label).closest('[data-option]');

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Option ${label} not found`);
  }

  return element;
}

function renderLibrary(onSelectStory = vi.fn()) {
  return render(
    <ScanSettingsProvider>
      <StudentLibrary
        studentId="student-1"
        studentName="Ana"
        onSelectStory={onSelectStory}
        onBack={vi.fn()}
      />
    </ScanSettingsProvider>,
  );
}

describe('StudentLibrary designs merge (SPEC-029)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(listStudentBooks).mockResolvedValue([BOOK_SUMMARY]);
    vi.mocked(listStudentDesigns).mockResolvedValue([DESIGN_SUMMARY]);
  });

  it('shows diseños read-only alongside books', async () => {
    renderLibrary();

    await screen.findByText('La aventura del dragón');
    await screen.findByText('Mi fiesta de cumple');
    expect(listStudentDesigns).toHaveBeenCalledWith('student-1');
  });

  it('opens a diseño through its detail and keeps its type', async () => {
    const onSelectStory = vi.fn();
    vi.mocked(getStudentDesign).mockResolvedValue({
      id: 'design-1',
      title: 'Mi fiesta de cumple',
      message: 'Fiesta de cumple el sábado a las 17',
      occasion: 'birthday',
      style: 'Acuarela',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    renderLibrary(onSelectStory);

    await screen.findByText('Mi fiesta de cumple');
    fireEvent.pointerDown(optionContaining('Mi fiesta de cumple'));

    await screen.findByText('Abriendo tu diseño...');
    expect(getStudentDesign).toHaveBeenCalledWith('design-1');
    await vi.waitFor(() => {
      expect(onSelectStory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'design-1',
          type: 'design',
          content: 'Fiesta de cumple el sábado a las 17',
        }),
      );
    });
  });

  it('has no axe violations with merged entries', async () => {
    const { container } = renderLibrary();

    await screen.findByText('Mi fiesta de cumple');
    await expectNoA11yViolations(container);
  });
});
