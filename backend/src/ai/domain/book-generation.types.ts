export const STORY_SIZES = ['small', 'medium', 'large'] as const;
export type StorySize = (typeof STORY_SIZES)[number];

export const AUDIENCES = ['child', 'teen', 'adult'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const BOOK_JOB_STATUSES = [
  'queued',
  'processing',
  'completed',
  'failed',
] as const;
export type BookJobStatus = (typeof BOOK_JOB_STATUSES)[number];
