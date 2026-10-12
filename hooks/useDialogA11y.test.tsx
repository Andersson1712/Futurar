import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDialogA11y } from './useDialogA11y';

function TestDialog({ onClose = vi.fn() }: { onClose?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useDialogA11y(ref, true, onClose);

  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Prueba">
      <button>Primero</button>
      <button>Segundo</button>
    </div>
  );
}

describe('useDialogA11y (SPEC-016)', () => {
  it('moves focus into the dialog on mount', () => {
    render(<TestDialog />);

    expect(document.activeElement).toBe(screen.getByText('Primero'));
  });

  it('traps Tab and Shift+Tab inside the dialog', () => {
    render(<TestDialog />);

    const first = screen.getByText('Primero');
    const second = screen.getByText('Segundo');

    second.focus();
    fireEvent.keyDown(second, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(second);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<TestDialog onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus when the dialog unmounts', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Abrir';
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(<TestDialog />);
    expect(document.activeElement).toBe(screen.getByText('Primero'));

    unmount();
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });
});
