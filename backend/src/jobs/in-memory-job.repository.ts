import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AiErrorDto } from '../common/dto/ai-error.dto';
import type { GeneratedBookDto } from '../ai/dto/generated-book.dto';
import { CreateJobInput, JobRecord, JobRepository } from './job.repository';

export const JOB_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InMemoryJobRepository implements JobRepository {
  private readonly jobs = new Map<string, JobRecord>();

  create(input: CreateJobInput): Promise<JobRecord> {
    this.removeExpired();

    const now = new Date();
    const record: JobRecord = {
      id: randomUUID(),
      userId: input.userId,
      profileId: input.profileId,
      status: 'queued',
      request: input.request,
      createdAt: now,
      updatedAt: now,
      expiresAt: Date.now() + JOB_TTL_MS,
    };

    this.jobs.set(record.id, record);
    return Promise.resolve(record);
  }

  markProcessing(jobId: string): Promise<void> {
    this.update(jobId, (job) => {
      job.status = 'processing';
    });

    return Promise.resolve();
  }

  complete(jobId: string, book: GeneratedBookDto): Promise<void> {
    this.update(jobId, (job) => {
      job.status = 'completed';
      job.book = book;
    });

    return Promise.resolve();
  }

  fail(jobId: string, error: AiErrorDto): Promise<void> {
    this.update(jobId, (job) => {
      job.status = 'failed';
      job.error = error;
    });

    return Promise.resolve();
  }

  findById(jobId: string): Promise<JobRecord | undefined> {
    return Promise.resolve(this.get(jobId));
  }

  find(jobId: string, userId: string): Promise<JobRecord | undefined> {
    const job = this.get(jobId);

    return Promise.resolve(job?.userId === userId ? job : undefined);
  }

  private get(jobId: string): JobRecord | undefined {
    const job = this.jobs.get(jobId);

    if (!job) return undefined;

    if (job.expiresAt !== undefined && job.expiresAt <= Date.now()) {
      this.jobs.delete(jobId);
      return undefined;
    }

    return job;
  }

  private update(jobId: string, mutate: (job: JobRecord) => void): void {
    const job = this.get(jobId);
    if (!job) return;

    mutate(job);
    job.updatedAt = new Date();
  }

  private removeExpired(): void {
    const now = Date.now();

    for (const [jobId, job] of this.jobs) {
      if (job.expiresAt !== undefined && job.expiresAt <= now) {
        this.jobs.delete(jobId);
      }
    }
  }
}
