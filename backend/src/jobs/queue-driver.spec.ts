import { ConfigService } from '@nestjs/config';
import { resolveQueueDriver } from './queue-driver';

describe('resolveQueueDriver', () => {
  it('honors an explicit driver', () => {
    expect(
      resolveQueueDriver(new ConfigService({ QUEUE_DRIVER: 'inline' })),
    ).toBe('inline');
    expect(
      resolveQueueDriver(
        new ConfigService({ QUEUE_DRIVER: 'bullmq', REDIS_URL: 'redis://x' }),
      ),
    ).toBe('bullmq');
  });

  it('defaults to bullmq when REDIS_URL is set', () => {
    expect(
      resolveQueueDriver(new ConfigService({ REDIS_URL: 'redis://localhost' })),
    ).toBe('bullmq');
  });

  it('defaults to inline without Redis', () => {
    expect(resolveQueueDriver(new ConfigService({}))).toBe('inline');
    expect(resolveQueueDriver(new ConfigService({ REDIS_URL: '  ' }))).toBe(
      'inline',
    );
  });
});
