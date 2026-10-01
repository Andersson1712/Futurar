export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');

export interface StoredIdempotentResponse {
  statusCode: number;
  body: unknown;
  requestHash: string;
  expiresAt: number;
}

export interface IdempotencyStore {
  get(scope: string): Promise<StoredIdempotentResponse | undefined>;
  set(scope: string, entry: StoredIdempotentResponse): Promise<void>;
}
