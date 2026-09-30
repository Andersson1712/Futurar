import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AiErrorDto } from '../../common/dto/ai-error.dto';
import type { BookJobStatus } from '../domain/book-generation.types';
import type { GeneratedBookDto } from '../dto/generated-book.dto';

export const JOB_TTL_MS = 24 * 60 * 60 * 1000;

export interface JobRecord {
  id: string;
  userId: string;
  status: BookJobStatus;
  book?: GeneratedBookDto;
  error?: AiErrorDto;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: number;
}

export interface JobRegistry {
  create(userId: string): JobRecord;
  complete(jobId: string, book: GeneratedBookDto): void;
  fail(jobId: string, error: AiErrorDto): void;
  find(jobId: string, userId: string): JobRecord | undefined;
}

@Injectable()
export class InMemoryJobRegistry implements JobRegistry {
  private readonly jobs = new Map<string, JobRecord>();

  create(userId: string): JobRecord {
    this.removeExpired();

    const now = new Date();
    const record: JobRecord = {
      id: randomUUID(),
      userId,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      expiresAt: Date.now() + JOB_TTL_MS,
    };

    this.jobs.set(record.id, record);
    return record;
  }

  complete(jobId: string, book: GeneratedBookDto): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'completed';
    job.book = book;
    job.updatedAt = new Date();
  }

  fail(jobId: string, error: AiErrorDto): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'failed';
    job.error = error;
    job.updatedAt = new Date();
  }

  find(jobId: string, userId: string): JobRecord | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    if (job.userId !== userId || job.expiresAt <= Date.now()) {
      if (job.expiresAt <= Date.now()) {
        this.jobs.delete(jobId);
      }
      return undefined;
    }

    return job;
  }

  private removeExpired(): void {
    const now = Date.now();

    for (const [jobId, job] of this.jobs) {
      if (job.expiresAt <= now) {
        this.jobs.delete(jobId);
      }
    }
  }
}
