export const PROGRESS_STORAGE_KEY = 'futurar_progress_v1';

export interface ProgressConfig {
  id?: string;
  protagonist: string;
  scenery: string;
  mission: string;
  style: string;
  title?: string;
  content?: string;
  imageUrl?: string;
  type: 'story' | 'design';
}

export interface ViewerProgress {
  storyId: string;
  scrollTop: number;
}

export interface StudentProgress {
  studentId: string;
  step: string;
  config: ProgressConfig;
  viewer?: ViewerProgress;
  updatedAt: string;
}

export const RESTORABLE_STEPS = [
  'MENU',
  'LIBRARY',
  'SELECT_PROTAGONIST',
  'SELECT_SCENERY',
  'SELECT_MISSION',
  'SELECT_STYLE',
  'STORY_DETAILS',
  'RESULT_VIEW',
] as const;

const TRANSIENT_STEPS: Record<string, string> = {
  GENERATING: 'SELECT_STYLE',
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizeStep(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  if (TRANSIENT_STEPS[value]) return TRANSIENT_STEPS[value];

  return (RESTORABLE_STEPS as readonly string[]).includes(value)
    ? value
    : undefined;
}

function normalizeConfig(value: unknown): ProgressConfig | undefined {
  if (!isRecord(value)) return undefined;

  return {
    id: asString(value.id),
    protagonist: asString(value.protagonist) ?? '',
    scenery: asString(value.scenery) ?? '',
    mission: asString(value.mission) ?? '',
    style: asString(value.style) ?? '',
    title: asString(value.title),
    content: asString(value.content),
    imageUrl: asString(value.imageUrl),
    type: value.type === 'design' ? 'design' : 'story',
  };
}

function normalizeViewer(value: unknown): ViewerProgress | undefined {
  if (!isRecord(value)) return undefined;

  const storyId = asString(value.storyId);
  const scrollTop = value.scrollTop;

  if (!storyId || typeof scrollTop !== 'number' || !Number.isFinite(scrollTop)) {
    return undefined;
  }

  return { storyId, scrollTop: Math.max(0, scrollTop) };
}

export function normalizeProgress(value: unknown): StudentProgress | undefined {
  if (!isRecord(value)) return undefined;

  const studentId = asString(value.studentId);
  const step = normalizeStep(value.step);
  const config = normalizeConfig(value.config);

  if (!studentId || !step || !config) return undefined;

  return {
    studentId,
    step,
    config,
    viewer: normalizeViewer(value.viewer),
    updatedAt: asString(value.updatedAt) ?? new Date().toISOString(),
  };
}

export function loadProgress(): StudentProgress | undefined {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);

    if (!raw) return undefined;

    return normalizeProgress(JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

export function saveProgress(progress: StudentProgress): boolean {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    // Storage full: retry without the viewer position before giving up.
    try {
      const { viewer: _viewer, ...rest } = progress;
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(rest));
      return true;
    } catch {
      return false;
    }
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
  } catch {
    // No-op when storage is unavailable.
  }
}
