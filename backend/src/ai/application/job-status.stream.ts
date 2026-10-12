import { Inject, Injectable } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import {
  Observable,
  ReplaySubject,
  concat,
  finalize,
  interval,
  map,
  merge,
  mergeMap,
  of,
  takeUntil,
  takeWhile,
  distinctUntilChanged,
  from,
} from 'rxjs';
import { AiErrorException } from '../../common/errors/ai-error.exception';
import { JOB_REPOSITORY } from '../../jobs/job.repository';
import type { JobRecord, JobRepository } from '../../jobs/job.repository';
import { toJobStatusDto } from './job-status.mapper';

export const JOB_STATUS_POLL_MS = 1_000;
export const JOB_STATUS_HEARTBEAT_MS = 15_000;

@Injectable()
export class JobStatusStream {
  constructor(@Inject(JOB_REPOSITORY) private readonly jobs: JobRepository) {}

  async open(jobId: string, userId: string): Promise<Observable<MessageEvent>> {
    const initial = await this.jobs.find(jobId, userId);

    if (!initial) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Job not found');
    }

    return createJobStatusStream(this.jobs, jobId, userId, initial);
  }
}

export function createJobStatusStream(
  jobs: JobRepository,
  jobId: string,
  userId: string,
  initial: JobRecord,
): Observable<MessageEvent> {
  // Replay the stop signal: when the initial snapshot is already terminal,
  // statusEvents$ completes synchronously during merge subscription, before
  // heartbeats$ subscribes to stop$. A plain Subject would drop the signal
  // and leave the heartbeat interval (and the HTTP stream) open forever.
  const stop$ = new ReplaySubject<void>(1);

  const changes$ = concat(
    of<JobRecord | undefined>(initial),
    interval(JOB_STATUS_POLL_MS).pipe(
      mergeMap(() => from(jobs.find(jobId, userId))),
    ),
  ).pipe(map((job) => snapshotJob(job)));

  const statusEvents$ = changes$.pipe(
    distinctUntilChanged((a, b) => fingerprint(a) === fingerprint(b)),
    takeWhile((job) => !isTerminal(job) && job !== undefined, true),
    map((job): MessageEvent => {
      if (!job) {
        return {
          type: 'error',
          data: {
            statusCode: 404,
            code: 'NOT_FOUND',
            message: 'Job not found',
          },
        };
      }

      return { type: 'status', data: toJobStatusDto(job) };
    }),
    finalize(() => stop$.next()),
  );

  const heartbeats$ = interval(JOB_STATUS_HEARTBEAT_MS).pipe(
    map((): MessageEvent => ({ type: 'heartbeat', data: '' })),
    takeUntil(stop$),
  );

  return merge(statusEvents$, heartbeats$);
}

function snapshotJob(job: JobRecord | undefined): JobRecord | undefined {
  if (!job) return job;

  // The repository may hand out its live stored record and mutate it in
  // place on transitions. Freeze each emission (with its own updatedAt
  // instance) so distinctUntilChanged compares point-in-time values instead
  // of two aliases of the same mutated object.
  return {
    ...job,
    request: { ...job.request },
    book: job.book ? { ...job.book } : undefined,
    error: job.error ? { ...job.error } : undefined,
    createdAt: new Date(job.createdAt.getTime()),
    updatedAt: new Date(job.updatedAt.getTime()),
  };
}

function isTerminal(job: JobRecord | undefined): boolean {
  return job?.status === 'completed' || job?.status === 'failed';
}

function fingerprint(job: JobRecord | undefined): string {
  if (!job) return 'missing';

  return `${job.status}:${job.updatedAt.getTime()}`;
}
