import type { ScanOption } from '../types';

export interface OptionPage {
  level: number;
  options: ScanOption[];
}

const DEFAULT_LEVEL = 1;

/**
 * SPEC-023B: group scan options into pages by `level` (ascending). Options with
 * no explicit level fall back to level 1, so legacy payloads stay on one page.
 */
export function buildOptionPages(options: ScanOption[]): OptionPage[] {
  const byLevel = new Map<number, ScanOption[]>();

  for (const option of options) {
    const level = option.level ?? DEFAULT_LEVEL;
    const list = byLevel.get(level) ?? [];

    list.push(option);
    byLevel.set(level, list);
  }

  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, pageOptions]) => ({ level, options: pageOptions }));
}

/** Advance to the next page, wrapping from the last page back to the first. */
export function nextPageIndex(current: number, total: number): number {
  if (total <= 0) return 0;

  return (current + 1) % total;
}
