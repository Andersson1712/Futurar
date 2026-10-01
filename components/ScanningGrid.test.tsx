import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScanningGrid from './ScanningGrid';
import type { ScanOption } from '../types';

vi.mock('../utils/speech', () => ({
  speakOption: vi.fn(),
  stopSpeaking: vi.fn(),
}));

vi.mock('../utils/audio', () => ({
  playSelectionSound: vi.fn(),
}));

const OPTIONS: ScanOption[] = [
  { id: 'a', label: 'Opción A', icon: 'star' },
  { id: 'b', label: 'Opción B', icon: 'bolt' },
];

function optionElement(label: string): HTMLElement {
  const element = screen.getByText(label).closest('[data-option]');

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Option ${label} not found`);
  }

  return element;
}

describe('ScanningGrid (SPEC-011)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('selects the pressed option on pointerdown even when another is focused', () => {
    const onSelect = vi.fn();
    render(<ScanningGrid options={OPTIONS} onSelect={onSelect} scanInterval={1000} />);

    // The scan focus starts on A; pressing B must win immediately.
    fireEvent.pointerDown(optionElement('Opción B'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[1]);
  });

  it('never selects on release alone', () => {
    const onSelect = vi.fn();
    render(<ScanningGrid options={OPTIONS} onSelect={onSelect} scanInterval={1000} />);

    fireEvent.pointerUp(optionElement('Opción B'));
    fireEvent.click(optionElement('Opción B'));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores double activation from the synthetic click after pointerdown', () => {
    const onSelect = vi.fn();
    render(<ScanningGrid options={OPTIONS} onSelect={onSelect} scanInterval={1000} />);

    const optionB = optionElement('Opción B');
    fireEvent.pointerDown(optionB);
    fireEvent.click(optionB);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('still selects the scan-focused option with Space', () => {
    const onSelect = vi.fn();
    render(<ScanningGrid options={OPTIONS} onSelect={onSelect} scanInterval={1000} />);

    fireEvent.keyDown(window, { code: 'Space' });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[0]);
  });

  it('pauses the scan timer while a selection is in flight', () => {
    const onSelect = vi.fn();
    render(<ScanningGrid options={OPTIONS} onSelect={onSelect} scanInterval={1000} />);

    fireEvent.pointerDown(optionElement('Opción B'));
    expect(onSelect).toHaveBeenCalledTimes(1);

    // The interval is cancelled during the selection lock, so no new focus
    // activation can fire while the UI reacts.
    fireEvent.keyDown(window, { code: 'Space' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('falls back to the focused option when pressing outside the options', () => {
    const onSelect = vi.fn();
    render(<ScanningGrid options={OPTIONS} onSelect={onSelect} scanInterval={1000} />);

    fireEvent.pointerDown(document.body);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[0]);
  });

  it('ignores input while paused', () => {
    const onSelect = vi.fn();
    render(
      <ScanningGrid
        options={OPTIONS}
        onSelect={onSelect}
        scanInterval={1000}
        isPaused
      />,
    );

    fireEvent.pointerDown(optionElement('Opción B'));
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(window, { code: 'Space' });

    expect(onSelect).not.toHaveBeenCalled();
  });
});
