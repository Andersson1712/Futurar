import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAccessibility } from './AccessibilityContext';
import {
  DEFAULT_ACCESSIBILITY,
  type AccessibilitySettings,
} from '../utils/accessibility';

function Probe({ settings }: { settings: AccessibilitySettings | null }) {
  useAccessibility(settings);
  return <div />;
}

function resetDocument(): void {
  const root = document.documentElement;
  root.removeAttribute('style');
  root.removeAttribute('data-font-size');
  root.removeAttribute('data-line-height');
  root.removeAttribute('data-bold-titles');
  root.removeAttribute('data-uppercase');
  root.removeAttribute('data-input-mode');
}

describe('useAccessibility (SPEC-015)', () => {
  afterEach(resetDocument);

  it('applies the profile settings to the document', () => {
    render(
      <Probe
        settings={{
          ...DEFAULT_ACCESSIBILITY,
          fontSize: 'large',
          lineHeight: 'relaxed',
          uppercase: true,
          boldTitles: true,
        }}
      />,
    );

    const root = document.documentElement;

    expect(root.style.fontSize).toBe('19px');
    expect(root.getAttribute('data-line-height')).toBe('relaxed');
    expect(root.getAttribute('data-uppercase')).toBe('true');
    expect(root.getAttribute('data-bold-titles')).toBe('true');
  });

  it('does nothing without an active profile', () => {
    render(<Probe settings={null} />);

    expect(document.documentElement.style.fontSize).toBe('');
    expect(document.documentElement.getAttribute('data-uppercase')).toBeNull();
  });
});
