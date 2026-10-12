import {
  ApiError,
  apiFetch,
  getAccessToken,
  getApiUrl,
  NetworkError,
} from './backendApi';
import type {
  Audience,
  JobStatusPayload,
  StorySize,
} from './bookTypes';

export interface BookGenerationInput {
  protagonist: string;
  scenery: string;
  mission: string;
  style: string;
  storySize: StorySize;
  customStructure?: string;
  audience?: Audience;
  profileId?: string;
}

export const JOB_POLL_INTERVAL_MS = 2000;

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `key-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function requestBookGeneration(
  input: BookGenerationInput,
): Promise<{ jobId: string; status: string }> {
  return apiFetch('/api/v1/ai/books/generate', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey() },
    body: JSON.stringify(input),
  });
}

export interface FollowJobHandlers {
  onStatus?: (status: JobStatusPayload) => void;
  signal?: AbortSignal;
}

export async function followJob(
  jobId: string,
  handlers: FollowJobHandlers = {},
): Promise<JobStatusPayload> {
  if (handlers.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  try {
    return await streamJob(jobId, handlers);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    if (
      error instanceof ApiError &&
      (error.statusCode === 401 || error.statusCode === 404)
    ) {
      throw error;
    }

    return pollJob(jobId, handlers);
  }
}

async function streamJob(
  jobId: string,
  handlers: FollowJobHandlers,
): Promise<JobStatusPayload> {
  const token = await getAccessToken();
  const response = await fetch(
    `${getApiUrl()}/api/v1/ai/jobs/${encodeURIComponent(jobId)}/events`,
    {
      headers: {
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: handlers.signal,
    },
  );

  if (!response.ok || !response.body) {
    throw new NetworkError('No se pudo abrir el stream de eventos');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let last: JobStatusPayload | undefined;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let separator = buffer.indexOf('\n\n');

    while (separator >= 0) {
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      separator = buffer.indexOf('\n\n');

      const event = parseSseFrame(frame);
      if (!event) continue;

      if (event.type === 'status' || event.type === 'message') {
        const status = event.data as JobStatusPayload;
        last = status;
        handlers.onStatus?.(status);

        if (status.status === 'completed' || status.status === 'failed') {
          return status;
        }
      } else if (event.type === 'error') {
        const body = event.data as { statusCode: number; code: string; message: string };
        throw new ApiError(body);
      }
    }
  }

  if (last) return last;

  throw new NetworkError('El stream terminó sin estado final');
}

async function pollJob(
  jobId: string,
  handlers: FollowJobHandlers,
): Promise<JobStatusPayload> {
  while (true) {
    const status = await apiFetch<JobStatusPayload>(
      `/api/v1/ai/jobs/${encodeURIComponent(jobId)}`,
    );
    handlers.onStatus?.(status);

    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }

    await delay(JOB_POLL_INTERVAL_MS, handlers.signal);
  }
}

function parseSseFrame(
  frame: string,
): { type: string; data: unknown } | undefined {
  let type = 'message';
  const dataLines: string[] = [];

  for (const line of frame.split('\n')) {
    if (line.startsWith(':')) continue;

    const separator = line.indexOf(':');
    const field = separator >= 0 ? line.slice(0, separator) : line;
    const value =
      separator >= 0 ? line.slice(separator + 1).replace(/^ /, '') : '';

    if (field === 'event') type = value;
    if (field === 'data') dataLines.push(value);
  }

  if (dataLines.length === 0) return undefined;

  try {
    return { type, data: JSON.parse(dataLines.join('\n')) as unknown };
  } catch {
    return undefined;
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}
