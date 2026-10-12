import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '../app.setup';
import { validateEnv } from '../config/env.validation';
import { REDIS_CLIENT } from '../common/redis/redis-client';
import { RedisModule } from '../common/redis/redis.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { REDIS_CLIENT } from '../common/redis/redis-client';
import { CORRELATION_ID_HEADER } from './correlation-id';
import { ObservabilityModule } from './observability.module';

@Controller('ping')
class PingController {
  @Get()
  ping(): Record<string, boolean> {
    return { ok: true };
  }
}

describe('HTTP observability wiring (SPEC-027)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: validateEnv,
        }),
        SupabaseModule,
        RedisModule,
        ObservabilityModule,
      ],
      controllers: [PingController],
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue(null)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('echoes a generated correlation id on every response', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/ping');

    expect(response.status).toBe(200);
    expect(response.headers[CORRELATION_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('honors an incoming correlation id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/ping')
      .set(CORRELATION_ID_HEADER, 'trace-123');

    expect(response.headers[CORRELATION_ID_HEADER]).toBe('trace-123');
  });

  it('serves the health probe without auth', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', redis: 'disabled' });
    expect(response.headers[CORRELATION_ID_HEADER]).toBeDefined();
  });

  it('keeps metrics behind teacher auth', async () => {
    await request(app.getHttpServer()).get('/api/v1/metrics').expect(401);
  });
});
