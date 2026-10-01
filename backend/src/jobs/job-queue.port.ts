export const JOB_QUEUE = Symbol('JOB_QUEUE');

export const BOOK_GENERATION_QUEUE = 'book-generation';

export interface BookJobPayload {
  jobId: string;
}

export interface JobQueue {
  enqueue(jobId: string): Promise<void>;
}
