import { Injectable, Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis-client';
import {
  IdempotencyStore,
  StoredIdempotentResponse,
} from './idempotency-store';

export const IDEMPOTENCY_KEY_PREFIX = 'futurar:idempotency:';

@Injectable()
export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get(scope: string): Promise<StoredIdempotentResponse | undefined> {
    const value = await this.redis.get(this.key(scope));

    if (!value) return undefined;

    return JSON.parse(value) as StoredIdempotentResponse;
  }

  async set(scope: string, entry: StoredIdempotentResponse): Promise<void> {
    const ttlMs = entry.expiresAt - Date.now();

    if (ttlMs <= 0) return;

    await this.redis.set(this.key(scope), JSON.stringify(entry), 'PX', ttlMs);
  }

  private key(scope: string): string {
    return `${IDEMPOTENCY_KEY_PREFIX}${scope}`;
  }
}
