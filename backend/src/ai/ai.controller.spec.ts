import { ExecutionContext, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../app.setup';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { InMemoryIdempotencyStore } from '../common/idempotency/in-memory-idempotency.store';
import { IDEMPOTENCY_STORE } from '../common/idempotency/idempotency-store';
import { SupabaseService } from '../supabase/supabase.service';
import { AiController } from './ai.controller';
import { BOOK_GENERATION_USE_CASE } from './application/book-generation.use-case';
import { JobStatusStream } from './application/job-status.stream';
import { AiEndpointsEnabledGuard } from './guards/ai-endpoints-enabled.guard';

const VALID_BODY = {
  protagonist: 'Un dragón curioso',
  scenery: 'Un bosque mágico',
  mission: 'Encontrar la estrella perdida',
  style: 'Acuarela',
  storySize: 'small',
};

interface AuthenticatedTestRequest {
  user?: { id: string };
}

describe('AiController', () => {
  let app: INestApplication<App>;
  const requestGeneration = jest.fn();
  const getJobStatus = jest.fn();
  const openStream = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        ConfigService,
        SupabaseService,
        { provide: IDEMPOTENCY_STORE, useClass: InMemoryIdempotencyStore },
        { provide: JobStatusStream, useValue: { open: openStream } },
        {
          provide: BOOK_GENERATION_USE_CASE,
          useValue: { requestGeneration, getJobStatus },
        },
      ],
    })
      .overrideGuard(AiEndpointsEnabledGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest<AuthenticatedTestRequest>().user = {
            id: 'user-1',
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the 202 contract response and forwards the user', async () => {
    requestGeneration.mockResolvedValue({ jobId: 'job-1', status: 'queued' });

    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/books/generate')
      .set('Idempotency-Key', 'key-12345678')
      .send(VALID_BODY)
      .expect(202);

    expect(response.body).toEqual({ jobId: 'job-1', status: 'queued' });
    expect(requestGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', storySize: 'small' }),
    );
  });

  it('rejects invalid payloads with VALIDATION_FAILED', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/books/generate')
      .set('Idempotency-Key', 'key-12345678')
      .send({ protagonist: 'Solo el protagonista' })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('rejects unknown properties (forbidNonWhitelisted)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/books/generate')
      .set('Idempotency-Key', 'key-12345678')
      .send({ ...VALID_BODY, apiKey: 'leaked' })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('requires the Idempotency-Key header', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/books/generate')
      .send(VALID_BODY)
      .expect(400);

    expect(response.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('replays idempotent responses without re-invoking the use case', async () => {
    requestGeneration.mockResolvedValue({ jobId: 'job-1', status: 'queued' });
    const key = 'key-12345678';

    await request(app.getHttpServer())
      .post('/api/v1/ai/books/generate')
      .set('Idempotency-Key', key)
      .send(VALID_BODY)
      .expect(202);

    const replay = await request(app.getHttpServer())
      .post('/api/v1/ai/books/generate')
      .set('Idempotency-Key', key)
      .send(VALID_BODY)
      .expect(202);

    expect(replay.body).toEqual({ jobId: 'job-1', status: 'queued' });
    expect(requestGeneration).toHaveBeenCalledTimes(1);
  });

  it('returns the job status contract', async () => {
    getJobStatus.mockResolvedValue({
      id: 'job-1',
      status: 'queued',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/ai/jobs/job-1')
      .expect(200);

    expect(response.body).toMatchObject({ id: 'job-1', status: 'queued' });
  });

  it('delegates SSE streams to JobStatusStream with the authenticated user', async () => {
    const controller = app.get(AiController);
    openStream.mockReturnValue({ subscribe: jest.fn() });

    await controller.streamJob('job-1', {
      user: { id: 'user-1' },
    } as unknown as Parameters<AiController['streamJob']>[1]);

    expect(openStream).toHaveBeenCalledWith('job-1', 'user-1');
  });
});
