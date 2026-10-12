import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiProduces } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import {
  assertRedisAvailable,
  REDIS_CLIENT,
} from '../common/redis/redis-client';
import type { RedisClient } from '../common/redis/redis-client';
import type { QueueDriverOption } from '../config/env.validation';

export interface HealthSnapshot {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  redis: 'up' | 'down' | 'disabled';
  queueDriver: QueueDriverOption;
}

/**
 * SPEC-027: public liveness/readiness probe. Never requires auth (probes
 * carry no token) and never crashes when Redis is down — it reports
 * degraded instead.
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness/readiness probe' })
  @ApiProduces('application/json')
  @ApiOkResponse()
  async check(): Promise<HealthSnapshot> {
    const redis = await this.redisStatus();
    const queueDriver =
      this.config.get<QueueDriverOption>('QUEUE_DRIVER') ?? 'inline';

    return {
      status: redis === 'down' ? 'degraded' : 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      redis,
      queueDriver,
    };
  }

  private async redisStatus(): Promise<HealthSnapshot['redis']> {
    if (!this.redis) return 'disabled';

    try {
      await assertRedisAvailable(this.redis);
      return 'up';
    } catch {
      return 'down';
    }
  }
}
