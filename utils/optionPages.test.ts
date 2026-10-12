import { describe, expect, it } from 'vitest';
import { buildOptionPages, nextPageIndex } from './optionPages';
import type { ScanOption } from '../types';

function option(id: string, level?: number): ScanOption {
  return { id, label: id, icon: 'star', level };
}

describe('optionPages (SPEC-023B)', () => {
  it('returns no pages for an empty list', () => {
    expect(buildOptionPages([])).toEqual([]);
  });

  it('treats missing levels as a single first page', () => {
    expect(buildOptionPages([option('a'), option('b')])).toEqual([
      { level: 1, options: [option('a'), option('b')] },
    ]);
  });

  it('groups and orders options by level', () => {
    const pages = buildOptionPages([
      option('a', 2),
      option('b', 1),
      option('c', 1),
      option('d', 3),
    ]);

    expect(pages.map((page) => page.level)).toEqual([1, 2, 3]);
    expect(pages[0].options.map((entry) => entry.id)).toEqual(['b', 'c']);
    expect(pages[1].options.map((entry) => entry.id)).toEqual(['a']);
  });

  it('wraps the page index', () => {
    expect(nextPageIndex(0, 3)).toBe(1);
    expect(nextPageIndex(2, 3)).toBe(0);
    expect(nextPageIndex(0, 0)).toBe(0);
  });
});
