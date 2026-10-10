import { ConfigService } from '@nestjs/config';

export type QueueDriver = 'inline' | 'bullmq';

export function resolveQueueDriver(configService: ConfigService): QueueDriver {
  const configured = configService
    .get<string>('QUEUE_DRIVER')
    ?.trim()
    .toLowerCase();

  if (configured === 'inline' || configured === 'bullmq') {
    return configured;
  }

  return configService.get<string>('REDIS_URL')?.trim() ? 'bullmq' : 'inline';
}
