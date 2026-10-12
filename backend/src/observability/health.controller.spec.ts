import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../common/redis/redis-client';
import { HealthController } from './health.controller';

async function buildController(redis: unknown) {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      { provide: REDIS_CLIENT, useValue: redis },
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => (key === 'QUEUE_DRIVER' ? 'inline' : undefined),
        },
      },
    ],
  }).compile();

  return moduleRef.get(HealthController);
}

describe('HealthController (SPEC-027)', () => {
  it('reports disabled when Redis is not configured', async () => {
    const controller = await buildController(null);
    const snapshot = await controller.check();

    expect(snapshot.status).toBe('ok');
    expect(snapshot.redis).toBe('disabled');
    expect(snapshot.queueDriver).toBe('inline');
  });

  it('reports up when Redis answers', async () => {
    const controller = await buildController({
      ping: () => Promise.resolve('PONG'),
    });
    const snapshot = await controller.check();

    expect(snapshot.status).toBe('ok');
    expect(snapshot.redis).toBe('up');
  });

  it('reports degraded (not a crash) when Redis is down', async () => {
    const controller = await buildController({
      ping: () => Promise.reject(new Error('connection refused')),
    });
    const snapshot = await controller.check();

    expect(snapshot.status).toBe('degraded');
    expect(snapshot.redis).toBe('down');
  });
});
