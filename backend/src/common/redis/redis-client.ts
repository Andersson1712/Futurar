import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export type RedisClient = Redis | null;

export const REDIS_CONNECT_TIMEOUT_MS = 5_000;

export function createRedisClient(url: string | undefined): RedisClient {
  const trimmed = url?.trim();

  if (!trimmed) return null;

  return new Redis(trimmed, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
}

export async function assertRedisAvailable(redis: Redis): Promise<void> {
  let timer: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Redis connection timed out')),
          REDIS_CONNECT_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
