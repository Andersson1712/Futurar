export const JOB_QUEUE = Symbol('JOB_QUEUE');

export const BOOK_GENERATION_QUEUE = 'book-generation';

export interface BookJobPayload {
  jobId: string;
  /** SPEC-027: end-to-end correlation id for job logs (never persisted). */
  correlationId?: string;
}

export interface JobQueue {
  enqueue(jobId: string, correlationId?: string): Promise<void>;
}
