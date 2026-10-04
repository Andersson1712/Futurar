import type { MessageEvent } from '@nestjs/common';
import { filter, lastValueFrom, take, toArray } from 'rxjs';
import { AiErrorException } from '../../common/errors/ai-error.exception';
import type { JobRecord, JobRepository } from '../../jobs/job.repository';
import type { JobStatusDto } from '../dto/generate-book-response.dto';
import {
  createJobStatusStream,
  JOB_STATUS_HEARTBEAT_MS,
  JOB_STATUS_POLL_MS,
  JobStatusStream,
} from './job-status.stream';

function buildJob(
  status: JobRecord['status'],
  updatedAt = new Date('2026-01-01T00:00:00.000Z'),
): JobRecord {
  return {
    id: 'job-1',
    userId: 'user-1',
    status,
    request: {
      protagonist: 'P',
      scenery: 'S',
      mission: 'M',
      style: 'Acuarela',
      storySize: 'small',
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt,
  };
}

function buildRepository() {
  const find = jest.fn();
  const repository = { find } as unknown as JobRepository;

  return { repository, find };
}

function statusEvents(events: MessageEvent[]): MessageEvent[] {
  return events.filter((event) => event.type === 'status');
}

describe('createJobStatusStream', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits snapshots on change and closes on terminal status', async () => {
    const { repository, find } = buildRepository();
    const initial = buildJob('queued');
    const processing = buildJob('processing', new Date(Date.now() + 1));
    const completed = buildJob('completed', new Date(Date.now() + 2));
    find.mockResolvedValueOnce(processing).mockResolvedValue(completed);

    const eventsPromise = lastValueFrom(
      createJobStatusStream(repository, 'job-1', 'user-1', initial).pipe(
        toArray(),
      ),
    );

    await jest.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS);
    await jest.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS);

    const events = await eventsPromise;
    const statuses = statusEvents(events);

    expect(statuses).toHaveLength(3);
    expect((statuses[0].data as JobStatusDto).status).toBe('queued');
    expect((statuses[1].data as JobStatusDto).status).toBe('processing');
    expect((statuses[2].data as JobStatusDto).status).toBe('completed');
    expect((statuses[2].data as JobStatusDto).progress).toBe(100);
  });

  it('does not repeat unchanged snapshots', async () => {
    const { repository, find } = buildRepository();
    const initial = buildJob('queued');
    const processing = buildJob('processing', new Date(Date.now() + 1));
    const completed = buildJob('completed', new Date(Date.now() + 2));
    find
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce(processing)
      .mockResolvedValue(completed);

    const eventsPromise = lastValueFrom(
      createJobStatusStream(repository, 'job-1', 'user-1', initial).pipe(
        toArray(),
      ),
    );

    await jest.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS);
    await jest.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS);
    await jest.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS);

    const statuses = statusEvents(await eventsPromise);

    expect(
      statuses.map((event) => (event.data as JobStatusDto).status),
    ).toEqual(['queued', 'processing', 'completed']);
  });

  it('emits heartbeats while idle', async () => {
    const { repository, find } = buildRepository();
    const queued = buildJob('queued');
    find.mockResolvedValue(queued);

    const heartbeatPromise = lastValueFrom(
      createJobStatusStream(repository, 'job-1', 'user-1', queued).pipe(
        filter((event) => event.type === 'heartbeat'),
        take(1),
      ),
    );

    await jest.advanceTimersByTimeAsync(JOB_STATUS_HEARTBEAT_MS);

    await expect(heartbeatPromise).resolves.toMatchObject({
      type: 'heartbeat',
    });
  });

  it('emits an error and closes when the job disappears', async () => {
    const { repository, find } = buildRepository();
    const initial = buildJob('queued');
    find.mockResolvedValue(undefined);

    const eventsPromise = lastValueFrom(
      createJobStatusStream(repository, 'job-1', 'user-1', initial).pipe(
        toArray(),
      ),
    );

    await jest.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS);

    const events = await eventsPromise;

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      type: 'error',
      data: { code: 'NOT_FOUND' },
    });
  });

  it('emits transitions when the repository mutates the stored record in place', async () => {
    const { repository, find } = buildRepository();
    // Same mutable reference on every poll, like InMemoryJobRepository.find.
    const live = buildJob('queued');
    find.mockImplementation(() => Promise.resolve(live));

    const received: MessageEvent[] = [];
    let completed = false;
    createJobStatusStream(repository, 'job-1', 'user-1', live).subscribe({
      next: (event) => received.push(event),
      complete: () => {
        completed = true;
      },
    });

    await jest.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS);
    live.status = 'processing';
    live.updatedAt = new Date(live.updatedAt.getTime() + 1);
    await jest.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS);
    live.status = 'completed';
    live.updatedAt = new Date(live.updatedAt.getTime() + 1);
    await jest.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS);
    await jest.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS);

    const statuses = statusEvents(received).map(
      (event) => (event.data as JobStatusDto).status,
    );

    expect(statuses).toEqual(['queued', 'processing', 'completed']);
    expect(completed).toBe(true);
  });

  it('closes immediately when the initial snapshot is already terminal', async () => {
    const { repository, find } = buildRepository();
    const completed = buildJob('completed');
    find.mockResolvedValue(completed);

    const events = await lastValueFrom(
      createJobStatusStream(repository, 'job-1', 'user-1', completed).pipe(
        toArray(),
      ),
    );

    expect(
      statusEvents(events).map((event) => (event.data as JobStatusDto).status),
    ).toEqual(['completed']);
  });

  it('stops polling after unsubscribe', async () => {
    const { repository, find } = buildRepository();
    const initial = buildJob('queued');

    const subscription = createJobStatusStream(
      repository,
      'job-1',
      'user-1',
      initial,
    ).subscribe();
    subscription.unsubscribe();

    await jest.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS * 3);

    expect(find).not.toHaveBeenCalled();
  });
});

describe('JobStatusStream', () => {
  it('opens a stream for existing jobs', async () => {
    const { repository, find } = buildRepository();
    const queued = buildJob('queued');
    find.mockResolvedValue(queued);
    const stream = new JobStatusStream(repository);

    await expect(stream.open('job-1', 'user-1')).resolves.toBeDefined();
  });

  it('rejects unknown jobs with 404 before streaming', async () => {
    const { repository, find } = buildRepository();
    find.mockResolvedValue(undefined);
    const stream = new JobStatusStream(repository);

    const error = await stream
      .open('missing', 'user-1')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiErrorException);
    expect((error as AiErrorException).getStatus()).toBe(404);
  });
});
