import type { Story } from '../types/database';
import type {
  BookDetailPayload,
  BookSummaryPayload,
  GeneratedBookPayload,
} from './bookTypes';

export interface StoryBookMeta {
  protagonist: string;
  scenery: string;
  mission: string;
  style: string;
  studentId: string;
  createdAt?: string;
}

export function bookToStory(
  book: GeneratedBookPayload,
  meta: StoryBookMeta,
): Story {
  return {
    id: book.id ?? 'generated',
    title: book.title,
    content: book.pages.map((page) => page.content).join('\n\n'),
    protagonist: meta.protagonist,
    scenery: meta.scenery,
    mission: meta.mission,
    style: meta.style,
    image_url: book.pages.find((page) => page.imageUrl)?.imageUrl ?? null,
    student_id: meta.studentId,
    type: 'story',
    created_at: meta.createdAt ?? new Date().toISOString(),
    is_favorite: false,
    dedication_to: book.dedication ?? null,
    dedication_reason: null,
    dedication_position: null,
  };
}

export function bookDetailToStory(
  book: BookDetailPayload,
  studentId: string,
): Story {
  return bookToStory(book, {
    protagonist: book.protagonist,
    scenery: book.scenery,
    mission: book.mission,
    style: book.style,
    studentId,
    createdAt: book.createdAt,
  });
}

export function bookSummaryToStory(
  summary: BookSummaryPayload,
  studentId: string,
): Story {
  return {
    id: summary.id,
    title: summary.title,
    content: '',
    protagonist: '',
    scenery: '',
    mission: '',
    style: '',
    image_url: null,
    student_id: studentId,
    type: 'story',
    created_at: summary.createdAt,
    is_favorite: false,
    dedication_to: null,
    dedication_reason: null,
    dedication_position: null,
  };
}
