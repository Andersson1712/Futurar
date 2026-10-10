import { supabase } from './supabase';

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3001'
).replace(/\/+$/, '');

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: string[];
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: string[];

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.statusCode = body.statusCode;
    this.code = body.code;
    this.details = body.details;
  }
}

export class NetworkError extends Error {
  constructor(message = 'No pudimos conectar con el servidor') {
    super(message);
    this.name = 'NetworkError';
  }
}

export function getApiUrl(): string {
  return API_URL;
}

export async function getAccessToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();

  return data.session?.access_token;
}

/**
 * Unauthenticated fetch for public kiosk endpoints (SPEC-024).
 * Sends no Bearer token and never touches the Supabase session,
 * so the student entry works without a teacher login.
 */
export async function apiFetchPublic<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return parse<T>(await send(path, init, undefined));
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retryOn401 = true,
): Promise<T> {
  const token = await getAccessToken();
  const response = await send(path, init, token);

  if (response.status === 401 && retryOn401) {
    const { data } = await supabase.auth.refreshSession();

    if (data.session) {
      return parse<T>(await send(path, init, data.session.access_token));
    }
  }

  return parse<T>(response);
}

async function send(
  path: string,
  init: RequestInit,
  token?: string,
): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new NetworkError();
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let body: unknown;

  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError(body);
    }

    throw new ApiError({
      statusCode: response.status,
      code: 'INTERNAL',
      message: 'Error inesperado del servidor',
    });
  }

  return body as T;
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'statusCode' in body &&
    'code' in body &&
    'message' in body
  );
}
