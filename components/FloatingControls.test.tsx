import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FloatingControls from './FloatingControls';
import { ScanSettingsProvider } from '../contexts/ScanSettingsContext';

vi.mock('../utils/speech', () => ({
  speak: vi.fn(),
  speakOption: vi.fn(),
  stopSpeaking: vi.fn(),
  announceBreak: vi.fn(),
  announceResume: vi.fn(),
}));

vi.mock('../utils/audio', () => ({
  playSelectionSound: vi.fn(),
}));

function renderControls(onGoToMenu = vi.fn()) {
  render(
    <ScanSettingsProvider onGoToMenu={onGoToMenu}>
      <FloatingControls onGoToMenu={onGoToMenu} />
    </ScanSettingsProvider>,
  );

  return { onGoToMenu };
}

function openMenu() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Controles de accesibilidad' }),
  );

  return screen.getByRole('dialog', { name: 'Controles' });
}

describe('FloatingControls (SPEC-013)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens as a dialog and moves focus inside', () => {
    renderControls();
    const dialog = openMenu();

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('does not close when pressing outside the menu', () => {
    renderControls();
    openMenu();

    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Controles de accesibilidad' }));

    expect(screen.getByRole('dialog', { name: 'Controles' })).toBeInTheDocument();
  });

  it('traps Tab inside the menu and cycles the active option', () => {
    renderControls();
    const dialog = openMenu();
    const options = within(dialog).getAllByRole('button');

    const firstActive = dialog.querySelector('[data-active="true"]');
    fireEvent.keyDown(window, { key: 'Tab' });

    const nextActive = dialog.querySelector('[data-active="true"]');
    expect(nextActive).not.toBe(firstActive);
    expect(screen.getByRole('dialog', { name: 'Controles' })).toBeInTheDocument();

    // A full cycle keeps the dialog open and returns to the first option
    for (let step = 0; step < options.length - 1; step += 1) {
      fireEvent.keyDown(window, { key: 'Tab' });
    }

    expect(screen.getByRole('dialog', { name: 'Controles' })).toBeInTheDocument();
    expect(dialog.querySelector('[data-active="true"]')).toBe(firstActive);
  });

  it('activates the focused option with Space (switch input)', () => {
    renderControls();
    const dialog = openMenu();

    fireEvent.keyDown(window, { key: ' ' });

    expect(within(dialog).getByText('Rápido')).toBeInTheDocument();
  });

  it('closes with Escape as an explicit action', () => {
    renderControls();
    openMenu();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('toggles pause from the menu and flips the label to Continuar', () => {
    renderControls();
    openMenu();

    fireEvent.click(screen.getByText('Tomar un Descanso'));
    expect(screen.queryByRole('dialog')).toBeNull();

    openMenu();
    expect(screen.getByText('Continuar')).toBeInTheDocument();
  });

  it('calls onGoToMenu when selecting Menú Principal', () => {
    const { onGoToMenu } = renderControls();
    openMenu();

    fireEvent.click(screen.getByText('Menú Principal'));
    vi.advanceTimersByTime(350);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onGoToMenu).toHaveBeenCalledTimes(1);
  });
});
