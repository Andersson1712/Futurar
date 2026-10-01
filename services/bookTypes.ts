export type StorySize = 'small' | 'medium' | 'large';
export type Audience = 'child' | 'teen' | 'adult';
export type BookJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface GeneratedPagePayload {
  pageNumber: number;
  content: string;
  imagePrompt?: string;
  imageUrl?: string;
}

export interface GeneratedBookPayload {
  id?: string;
  version?: number;
  title: string;
  dedication?: string;
  totalPages: number;
  pages: GeneratedPagePayload[];
}

export interface JobErrorPayload {
  statusCode: number;
  code: string;
  message: string;
}

export interface JobStatusPayload {
  id: string;
  bookId?: string;
  status: BookJobStatus;
  progress?: number;
  book?: GeneratedBookPayload;
  error?: JobErrorPayload;
  createdAt: string;
  updatedAt: string;
}

export interface BookSummaryPayload {
  id: string;
  title: string;
  pageCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookDetailPayload extends GeneratedBookPayload {
  protagonist: string;
  scenery: string;
  mission: string;
  style: string;
  version: number;
  totalPages: number;
  pages: GeneratedPagePayload[];
  createdAt: string;
  updatedAt: string;
}
