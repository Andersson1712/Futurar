import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearProgress,
  loadProgress,
  normalizeProgress,
  PROGRESS_STORAGE_KEY,
  RESTORABLE_STEPS,
  saveProgress,
  type StudentProgress,
} from './progressStore';

const PROGRESS: StudentProgress = {
  studentId: 'student-1',
  step: 'SELECT_SCENERY',
  config: {
    protagonist: 'Un dragón',
    scenery: '',
    mission: '',
    style: '',
    type: 'story',
  },
  viewer: { storyId: 'book-1', scrollTop: 120 },
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('progressStore (SPEC-014)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('roundtrips progress', () => {
    expect(saveProgress(PROGRESS)).toBe(true);
    expect(loadProgress()).toEqual(PROGRESS);
  });

  it('returns undefined without stored progress', () => {
    expect(loadProgress()).toBeUndefined();
  });

  it('discards corrupt or unrelated payloads', () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, '{not json');
    expect(loadProgress()).toBeUndefined();

    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    expect(loadProgress()).toBeUndefined();
  });

  it('maps transient steps and rejects unknown ones', () => {
    expect(
      normalizeProgress({ ...PROGRESS, step: 'GENERATING' })?.step,
    ).toBe('SELECT_STYLE');

    expect(
      normalizeProgress({ ...PROGRESS, step: 'TOTALLY_UNKNOWN' }),
    ).toBeUndefined();

    for (const step of RESTORABLE_STEPS) {
      expect(normalizeProgress({ ...PROGRESS, step })?.step).toBe(step);
    }
  });

  it('accepts an empty config (menu-level progress) but requires a config object', () => {
    expect(normalizeProgress({ ...PROGRESS, config: {} })?.step).toBe(
      'SELECT_SCENERY',
    );
    expect(normalizeProgress({ ...PROGRESS, config: 'nope' })).toBeUndefined();
    expect(normalizeProgress({ ...PROGRESS, config: undefined })).toBeUndefined();
  });

  it('clears progress', () => {
    saveProgress(PROGRESS);
    clearProgress();

    expect(loadProgress()).toBeUndefined();
  });

  it('drops the viewer when storage rejects the full payload', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    setItem.mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });

    expect(saveProgress(PROGRESS)).toBe(true);
    expect(loadProgress()?.viewer).toBeUndefined();
    expect(loadProgress()?.studentId).toBe('student-1');

    setItem.mockRestore();
  });
});
